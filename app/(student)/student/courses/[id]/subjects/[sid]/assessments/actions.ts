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
import { getLessonGateState } from '@/lib/lessons/queries'

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
    select: {
      id: true,
      lessonId: true,
      passingScore: true,
      subject: { select: { gender: true } },
    },
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

  // A locked gate is closed even to a student who already holds a failed
  // attempt on it - retaking a gate does not bypass the sequential order.
  if (assessment.lessonId != null) {
    const gateState = await getLessonGateState(session.userId, assessment.lessonId)
    if (gateState?.isLocked) return { error: 'Assessment is not available.' }
  }

  const attempts = await db.assessmentAttempt.findMany({
    where: { assessmentId: aid, userId: session.userId },
    orderBy: { startedAt: 'desc' },
    select: { id: true, status: true, score: true },
  })

  // Resume an in-progress attempt.
  const inProgress = attempts.find(a => a.status === 'IN_PROGRESS')
  if (inProgress) {
    redirect(attemptPath(courseId, subjectId, aid, inProgress.id))
    return { error: null }
  }

  const completed = attempts.filter(a => a.status !== 'IN_PROGRESS')
  if (completed.length > 0) {
    // Subject-level assessments keep the one-attempt rule. Only lesson gates
    // retake, because a gate that cannot be retaken locks a student out of the
    // rest of the subject permanently.
    if (assessment.lessonId == null) {
      redirect(attemptPath(courseId, subjectId, aid, completed[0].id))
      return { error: null }
    }
    const passed =
      assessment.passingScore != null &&
      completed.find(a => a.score != null && a.score >= assessment.passingScore!)
    if (passed) {
      redirect(attemptPath(courseId, subjectId, aid, passed.id))
      return { error: null }
    }
  }

  const created = await db.assessmentAttempt.create({
    data: { assessmentId: aid, userId: session.userId, status: 'IN_PROGRESS' },
    select: { id: true },
  })

  redirect(attemptPath(courseId, subjectId, aid, created.id))
  return { error: null }
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
          lessonId: true,
          passingScore: true,
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

  // A student removed from the course mid-attempt must not be able to submit
  // and be graded. The attempt query above scopes by userId and active course
  // but says nothing about the enrollment, so it is checked here the same way
  // startAttemptAction checks it.
  const enrollment = await db.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: session.userId,
        courseId: attempt.assessment.subject.courseId,
      },
      ...ACTIVE_ENROLLMENT,
    },
    select: { id: true },
  })
  if (!enrollment) return { error: 'Not enrolled in this course.' }

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

      // Passing a gate is what marks the lesson done, so the same
      // LessonCompletion row the manual button writes is written here. Keeping
      // it in this transaction means a student is never scored as passing
      // without the lesson opening. The upsert is idempotent, so the concurrent
      // -submit guard above needs no change.
      const { lessonId, passingScore } = attempt.assessment
      if (
        lessonId != null &&
        passingScore != null &&
        scored.score != null &&
        scored.score >= passingScore
      ) {
        await tx.lessonCompletion.upsert({
          where: { userId_lessonId: { userId: session.userId, lessonId } },
          create: { userId: session.userId, lessonId },
          update: {},
        })
      }
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
  revalidatePath('/student/courses/' + courseId)
  revalidatePath('/student/dashboard')
  redirect(attemptPath(courseId, subjectId, attempt.assessmentId, attempt.id))
  return { error: null }
}
