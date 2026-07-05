'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { canManageSubject } from '@/lib/auth/capabilities'
import { recomputeAttemptScore } from '@/lib/assessments/grading'

type ActionState = { error: string | null; success?: boolean }

// Finalize essay grading for one attempt (D6). Reads a points + feedback field
// per essay question, requires every essay to be scored, recomputes the
// attempt's percentage, and transitions it to GRADED (stamping gradedBy/gradedAt).
// Re-finalizing an already-GRADED attempt updates points/feedback/score.
export async function finalizeAttemptGradingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const attemptId = formData.get('attemptId')
  if (typeof attemptId !== 'string' || !attemptId)
    return { error: 'Invalid attempt ID.' }

  const subjectId = formData.get('subjectId')
  if (typeof subjectId !== 'string' || !subjectId)
    return { error: 'Invalid subject ID.' }

  const basePath = formData.get('basePath')
  if (typeof basePath !== 'string' || !basePath)
    return { error: 'Invalid base path.' }

  if (!(await canManageSubject(session, subjectId)))
    return { error: 'Forbidden' }

  const attempt = await db.assessmentAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      status: true,
      assessmentId: true,
      assessment: {
        select: {
          subjectId: true,
          questions: { select: { id: true, type: true, points: true } },
        },
      },
      answers: { select: { id: true, questionId: true, pointsEarned: true } },
    },
  })
  if (!attempt) return { error: 'Attempt not found.' }
  // Defensive: the attempt must belong to the subject the caller authorized for.
  if (attempt.assessment.subjectId !== subjectId) return { error: 'Forbidden' }
  if (attempt.status === 'IN_PROGRESS') {
    return { error: 'This attempt has not been submitted yet.' }
  }

  const answerByQuestion = new Map(
    attempt.answers.map((a) => [a.questionId, a]),
  )
  const essayQuestions = attempt.assessment.questions.filter(
    (q) => q.type === 'ESSAY',
  )

  // Parse + validate each essay's points; collect feedback.
  const grades: Array<{
    answerId: string
    questionId: string
    points: number
    feedback: string | null
  }> = []
  for (const q of essayQuestions) {
    const raw = formData.get('points_' + q.id)
    if (raw === null || String(raw).trim() === '') {
      return { error: 'Please score every essay answer before finalizing.' }
    }
    const points = Number(raw)
    if (!Number.isFinite(points) || points < 0 || points > q.points) {
      return {
        error: 'Points for each essay must be between 0 and its maximum.',
      }
    }
    const feedbackRaw = formData.get('feedback_' + q.id)
    const feedback =
      typeof feedbackRaw === 'string' && feedbackRaw.trim() !== ''
        ? feedbackRaw.trim()
        : null

    const answer = answerByQuestion.get(q.id)
    if (!answer)
      return { error: 'Missing answer record for an essay question.' }
    grades.push({ answerId: answer.id, questionId: q.id, points, feedback })
  }

  // Recompute the percentage from objective points (already stored) + the new
  // essay points.
  const pointsEarnedById = new Map<string, number>()
  for (const a of attempt.answers) {
    if (a.pointsEarned != null)
      pointsEarnedById.set(a.questionId, a.pointsEarned)
  }
  for (const g of grades) pointsEarnedById.set(g.questionId, g.points)

  const score = recomputeAttemptScore(
    attempt.assessment.questions,
    pointsEarnedById,
  )

  try {
    await db.$transaction(async (tx) => {
      for (const g of grades) {
        await tx.studentAnswer.update({
          where: { id: g.answerId },
          data: { pointsEarned: g.points, feedback: g.feedback },
        })
      }
      await tx.assessmentAttempt.update({
        where: { id: attemptId },
        data: {
          score,
          status: 'GRADED',
          gradedById: session.userId,
          gradedAt: new Date(),
        },
      })
    })
  } catch (err) {
    console.error('[finalizeAttemptGrading]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath(basePath + '/assessments/' + attempt.assessmentId)
  revalidatePath(
    basePath +
      '/assessments/' +
      attempt.assessmentId +
      '/attempts/' +
      attemptId,
  )
  revalidatePath(basePath + '/grades')
  redirect(basePath + '/assessments/' + attempt.assessmentId)
}

const finalGradeSchema = z.object({
  finalGrade: z.coerce
    .number()
    .min(0, 'Grade must be between 0 and 100.')
    .max(100, 'Grade must be between 0 and 100.'),
})

// Save (upsert) a student's final grade for a subject (D9/D12). The value is
// teacher-confirmed (may be the weighted suggestion or an override).
export async function saveFinalGradeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const subjectId = formData.get('subjectId')
  if (typeof subjectId !== 'string' || !subjectId)
    return { error: 'Invalid subject ID.' }

  const studentId = formData.get('studentId')
  if (typeof studentId !== 'string' || !studentId)
    return { error: 'Invalid student ID.' }

  const basePath = formData.get('basePath')
  if (typeof basePath !== 'string' || !basePath)
    return { error: 'Invalid base path.' }

  if (!(await canManageSubject(session, subjectId)))
    return { error: 'Forbidden' }

  const result = finalGradeSchema.safeParse({
    finalGrade: formData.get('finalGrade'),
  })
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed.' }
  }

  try {
    await db.grade.upsert({
      where: { userId_subjectId: { userId: studentId, subjectId } },
      create: {
        userId: studentId,
        subjectId,
        finalGrade: result.data.finalGrade,
      },
      update: { finalGrade: result.data.finalGrade },
    })
  } catch (err) {
    console.error('[saveFinalGrade]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath(basePath + '/grades')
  return { error: null, success: true }
}
