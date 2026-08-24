'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { isActiveStudent } from '@/lib/auth/capabilities'
import { scoreAttempt, type SubmittedAnswer } from '@/lib/assessments/scoring'
import { canSeeSubject } from '@/lib/subjects/visibility'
import { getUserGender } from '@/lib/subjects/access'
import { ACTIVE_COURSE } from '@/lib/courses/archive'
import { ACTIVE_ENROLLMENT } from '@/lib/enrollments/active'

type ActionState = { error: string | null }

// Thrown inside the submit transaction when the attempt was concurrently
// submitted, to roll back before duplicate answers are written.
class AlreadySubmittedError extends Error {}

function attemptPath(courseId: string, subjectId: string, aid: string, attemptId: string): string {
  return (
    '/student/courses/' + courseId +
    '/subjects/' + subjectId +
    '/assessments/' + aid +
    '/attempt/' + attemptId
  )
}

// Starts (or resumes) an attempt for the current student.
// Resume in-progress, block a second completed attempt (D4), require publish +
// enrollment (D8).
export async function startAttemptAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!(await isActiveStudent(session))) return { error: 'Your account is inactive.' }

  const aid = formData.get('assessmentId')
  const courseId = formData.get('courseId')
  const subjectId = formData.get('subjectId')
  if (typeof aid !== 'string' || !aid) return { error: 'Invalid assessment.' }
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course.' }
  if (typeof subjectId !== 'string' || !subjectId) return { error: 'Invalid subject.' }

  const assessment = await db.assessment.findFirst({
    where: {
      id: aid,
      isPublished: true,
      subjectId,
      subject: { courseId, course: { ...ACTIVE_COURSE } },
    },
    select: { id: true, subject: { select: { gender: true } } },
  })
  if (!assessment) return { error: 'Assessment is not available.' }

  // Hard boundary: block starting an attempt in a subject restricted to a
  // different gender (D2).
  const userGender = await getUserGender(session.userId)
  if (!canSeeSubject(userGender, assessment.subject.gender)) {
    return { error: 'Assessment is not available.' }
  }

  const enrollment = await db.enrollment.findUnique({
    where: {
      userId_courseId: { userId: session.userId, courseId },
      ...ACTIVE_ENROLLMENT,
    },
    select: { id: true },
  })
  if (!enrollment) return { error: 'Not enrolled in this course.' }

  const existing = await db.assessmentAttempt.findFirst({
    where: { assessmentId: aid, userId: session.userId },
    orderBy: { startedAt: 'desc' },
    select: { id: true, status: true },
  })

  // Resume an in-progress attempt, or route to the review of a completed one.
  if (existing) {
    redirect(attemptPath(courseId, subjectId, aid, existing.id))
  }

  const created = await db.assessmentAttempt.create({
    data: { assessmentId: aid, userId: session.userId, status: 'IN_PROGRESS' },
    select: { id: true },
  })

  redirect(attemptPath(courseId, subjectId, aid, created.id))
}

// Submits an in-progress attempt: persists answers, auto-scores objective
// questions, finalizes status (D2, D3, D9). Auto-accepts regardless of time.
export async function submitAttemptAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!(await isActiveStudent(session))) return { error: 'Your account is inactive.' }

  const attemptId = formData.get('attemptId')
  if (typeof attemptId !== 'string' || !attemptId) return { error: 'Invalid attempt.' }

  const attempt = await db.assessmentAttempt.findFirst({
    where: {
      id: attemptId,
      userId: session.userId,
      assessment: { subject: { course: { ...ACTIVE_COURSE } } },
    },
    select: {
      id: true,
      status: true,
      assessmentId: true,
      assessment: {
        select: {
          isPublished: true,
          subjectId: true,
          subject: { select: { courseId: true, gender: true } },
          questions: {
            select: {
              id: true,
              type: true,
              points: true,
              options: { select: { value: true, isCorrect: true } },
            },
          },
        },
      },
    },
  })
  if (!attempt) return { error: 'Attempt not found.' }
  if (attempt.status !== 'IN_PROGRESS') return { error: 'This attempt has already been submitted.' }
  if (!attempt.assessment.isPublished) {
    return { error: 'This assessment is no longer available.' }
  }
  const userGender = await getUserGender(session.userId)
  if (!canSeeSubject(userGender, attempt.assessment.subject.gender)) {
    return { error: 'This assessment is no longer available.' }
  }

  const submitted: SubmittedAnswer[] = attempt.assessment.questions.map(q => ({
    questionId: q.id,
    answer: String(formData.get('answer_' + q.id) ?? '').trim(),
  }))

  const scored = scoreAttempt(attempt.assessment.questions, submitted)

  try {
    await db.$transaction(async tx => {
      // Guarded transition doubles as a lock: a concurrent submit (e.g. the
      // timer auto-submit racing a manual click) matches 0 rows here and aborts
      // before inserting duplicate answers.
      const claimed = await tx.assessmentAttempt.updateMany({
        where: { id: attempt.id, status: 'IN_PROGRESS' },
        data: { status: scored.status, score: scored.score, submittedAt: new Date() },
      })
      if (claimed.count === 0) throw new AlreadySubmittedError()

      await tx.studentAnswer.createMany({
        data: scored.answers.map(a => ({
          attemptId: attempt.id,
          questionId: a.questionId,
          answer: a.answer,
          isCorrect: a.isCorrect,
          pointsEarned: a.pointsEarned,
        })),
      })
    })
  } catch (err) {
    if (err instanceof AlreadySubmittedError) {
      return { error: 'This attempt has already been submitted.' }
    }
    console.error('[submitAttempt]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  const courseId = attempt.assessment.subject.courseId
  const subjectId = attempt.assessment.subjectId
  revalidatePath('/student/courses/' + courseId + '/subjects/' + subjectId)
  revalidatePath('/student/dashboard')
  redirect(attemptPath(courseId, subjectId, attempt.assessmentId, attempt.id))
}
