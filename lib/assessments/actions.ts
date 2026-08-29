'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { canManageSubject } from '@/lib/auth/capabilities'
import { getPublishBlockers } from '@/lib/assessments/publish-validation'
import { parseMedia } from '@/lib/assessments/media'

// Neutral assessment + question authoring actions shared by the admin and
// teacher route groups. Authorization is by capability (canManageSubject), and
// every redirect/revalidate target is driven by the `basePath` the caller's
// form supplies (e.g. `/admin/courses/<cid>/subjects/<sid>` or
// `/teacher/subjects/<sid>`), so one implementation serves both surfaces.

type ActionState = { error: string | null; success?: boolean }

const assessmentSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  type: z.enum(['QUIZ', 'EXAM']),
  durationMins: z.coerce.number().int().min(1).optional(),
  passingScore: z.coerce.number().min(0).max(100).optional(),
  maxAttempts: z.coerce.number().int().min(1).optional(),
  weight: z.coerce.number().positive().default(1),
})

const questionSchema = z.object({
  questionText: z.string().min(1, 'Question text is required.'),
  type: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'ESSAY']),
  points: z.coerce.number().int().min(1, 'Points must be at least 1.'),
})

async function countAttempts(assessmentId: string): Promise<number> {
  return db.assessmentAttempt.count({ where: { assessmentId } })
}

// Resolve + authorize the subject the request targets. Returns the trimmed
// subjectId and basePath, or an error string for the action to surface.
async function authorize(
  formData: FormData,
): Promise<{ subjectId: string; basePath: string } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const subjectId = formData.get('subjectId')
  if (typeof subjectId !== 'string' || !subjectId)
    return { error: 'Invalid subject ID.' }

  const basePath = formData.get('basePath')
  if (typeof basePath !== 'string' || !basePath)
    return { error: 'Invalid base path.' }

  if (!(await canManageSubject(session, subjectId)))
    return { error: 'Forbidden' }

  return { subjectId, basePath }
}

type OptionRow = { label: string; value: string; isCorrect: boolean }

function parseOptions(type: string, formData: FormData): OptionRow[] | string {
  if (type === 'ESSAY') return []

  if (type === 'TRUE_FALSE') {
    const tfCorrect = formData.get('tfCorrect')
    if (tfCorrect !== 'true' && tfCorrect !== 'false') {
      return 'Please select the correct answer for True/False.'
    }
    return [
      { label: 'True', value: 'true', isCorrect: tfCorrect === 'true' },
      { label: 'False', value: 'false', isCorrect: tfCorrect === 'false' },
    ]
  }

  if (type === 'MULTIPLE_CHOICE') {
    const texts = formData.getAll('optionText').map((v) => String(v).trim())
    const correctIndexRaw = formData.get('correctIndex')
    if (correctIndexRaw === null || correctIndexRaw === '') {
      return 'Please select a correct answer.'
    }
    const correctIndex = Number(correctIndexRaw)

    if (texts.length < 2 || texts.length > 6) {
      return 'Multiple choice questions must have 2-6 options.'
    }
    if (texts.some((t) => t === '')) {
      return 'All option texts must be non-empty.'
    }
    const lower = texts.map((t) => t.toLowerCase())
    if (new Set(lower).size !== lower.length) {
      return 'Options must be unique.'
    }
    if (correctIndex < 0 || correctIndex >= texts.length) {
      return 'Invalid correct answer selection.'
    }
    return texts.map((t, i) => ({
      label: t,
      value: t,
      isCorrect: i === correctIndex,
    }))
  }

  return 'Unknown question type.'
}

export async function createAssessmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authorize(formData)
  if ('error' in auth) return auth
  const { subjectId, basePath } = auth

  const raw = {
    title: formData.get('title'),
    type: formData.get('type'),
    durationMins: formData.get('durationMins') || undefined,
    passingScore: formData.get('passingScore') || undefined,
    maxAttempts: formData.get('maxAttempts') || undefined,
    weight: formData.get('weight') || 1,
  }

  const result = assessmentSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed.' }
  }

  let created: { id: string }
  try {
    created = await db.assessment.create({
      data: {
        subjectId,
        title: result.data.title,
        type: result.data.type,
        durationMins: result.data.durationMins ?? null,
        passingScore: result.data.passingScore ?? null,
        maxAttempts: result.data.maxAttempts ?? null,
        weight: result.data.weight,
      },
      select: { id: true },
    })
  } catch (err) {
    console.error('[createAssessment]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath(basePath)
  redirect(basePath + '/assessments/' + created.id)
}

export async function updateAssessmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authorize(formData)
  if ('error' in auth) return auth
  const { basePath } = auth

  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return { error: 'Invalid assessment ID.' }

  const raw = {
    title: formData.get('title'),
    type: formData.get('type'),
    durationMins: formData.get('durationMins') || undefined,
    passingScore: formData.get('passingScore') || undefined,
    maxAttempts: formData.get('maxAttempts') || undefined,
    weight: formData.get('weight') || 1,
  }

  const result = assessmentSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed.' }
  }

  try {
    await db.assessment.update({
      where: { id },
      data: {
        title: result.data.title,
        type: result.data.type,
        durationMins: result.data.durationMins ?? null,
        passingScore: result.data.passingScore ?? null,
        maxAttempts: result.data.maxAttempts ?? null,
        weight: result.data.weight,
      },
    })
  } catch (err) {
    console.error('[updateAssessment]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath(basePath + '/assessments/' + id)
  revalidatePath(basePath)
  return { error: null, success: true }
}

export async function deleteAssessmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authorize(formData)
  if ('error' in auth) return auth
  const { basePath } = auth

  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return { error: 'Invalid assessment ID.' }

  const attempts = await countAttempts(id)
  if (attempts > 0) {
    return {
      error:
        'Cannot delete an assessment that has student attempts. Unpublish it instead.',
    }
  }

  try {
    await db.$transaction(async (tx) => {
      const questions = await tx.question.findMany({
        where: { assessmentId: id },
        select: { id: true },
      })
      const qids = questions.map((q) => q.id)
      if (qids.length > 0) {
        await tx.questionOption.deleteMany({
          where: { questionId: { in: qids } },
        })
        await tx.question.deleteMany({ where: { assessmentId: id } })
      }
      await tx.assessment.delete({ where: { id } })
    })
  } catch (err) {
    console.error('[deleteAssessment]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath(basePath)
  revalidatePath(basePath + '/assessments')
  redirect(basePath + '/assessments')
}

export async function publishAssessmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authorize(formData)
  if ('error' in auth) return auth
  const { basePath } = auth

  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return { error: 'Invalid assessment ID.' }

  const assessment = await db.assessment.findUnique({
    where: { id },
    select: {
      questions: {
        orderBy: { order: 'asc' },
        select: { type: true, options: { select: { isCorrect: true } } },
      },
    },
  })
  if (!assessment) return { error: 'Assessment not found.' }

  const blockers = getPublishBlockers(assessment.questions)
  if (blockers.length > 0) return { error: blockers[0] }

  try {
    await db.assessment.update({ where: { id }, data: { isPublished: true } })
  } catch (err) {
    console.error('[publishAssessment]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath(basePath + '/assessments/' + id)
  revalidatePath(basePath)
  return { error: null, success: true }
}

export async function unpublishAssessmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authorize(formData)
  if ('error' in auth) return auth
  const { basePath } = auth

  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return { error: 'Invalid assessment ID.' }

  try {
    await db.assessment.update({ where: { id }, data: { isPublished: false } })
  } catch (err) {
    console.error('[unpublishAssessment]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath(basePath + '/assessments/' + id)
  revalidatePath(basePath)
  return { error: null, success: true }
}

export async function createQuestionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authorize(formData)
  if ('error' in auth) return auth
  const { basePath } = auth

  const assessmentId = formData.get('assessmentId')
  if (typeof assessmentId !== 'string' || !assessmentId)
    return { error: 'Invalid assessment ID.' }

  const attempts = await countAttempts(assessmentId)
  if (attempts > 0) {
    return {
      error:
        'Questions are locked because students have attempted this assessment.',
    }
  }

  const raw = {
    questionText: formData.get('questionText'),
    type: formData.get('type'),
    points: formData.get('points'),
  }

  const result = questionSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed.' }
  }

  const optionsOrError = parseOptions(result.data.type, formData)
  if (typeof optionsOrError === 'string') return { error: optionsOrError }

  const mediaOrError = parseMedia(formData)
  if (typeof mediaOrError === 'string') return { error: mediaOrError }

  try {
    const maxOrder = await db.question.aggregate({
      where: { assessmentId },
      _max: { order: true },
    })
    const order = (maxOrder._max.order ?? 0) + 1

    await db.$transaction(async (tx) => {
      const question = await tx.question.create({
        data: {
          assessmentId,
          questionText: result.data.questionText,
          type: result.data.type,
          points: result.data.points,
          order,
          mediaType: mediaOrError.mediaType,
          mediaUrl: mediaOrError.mediaUrl,
        },
        select: { id: true },
      })
      if (optionsOrError.length > 0) {
        await tx.questionOption.createMany({
          data: optionsOrError.map((o) => ({ ...o, questionId: question.id })),
        })
      }
    })
  } catch (err) {
    console.error('[createQuestion]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath(basePath + '/assessments/' + assessmentId)
  redirect(basePath + '/assessments/' + assessmentId)
}

export async function updateQuestionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authorize(formData)
  if ('error' in auth) return auth
  const { basePath } = auth

  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return { error: 'Invalid question ID.' }

  const assessmentId = formData.get('assessmentId')
  if (typeof assessmentId !== 'string' || !assessmentId)
    return { error: 'Invalid assessment ID.' }

  const attempts = await countAttempts(assessmentId)
  if (attempts > 0) {
    return {
      error:
        'Questions are locked because students have attempted this assessment.',
    }
  }

  const raw = {
    questionText: formData.get('questionText'),
    type: formData.get('type'),
    points: formData.get('points'),
  }

  const result = questionSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed.' }
  }

  const optionsOrError = parseOptions(result.data.type, formData)
  if (typeof optionsOrError === 'string') return { error: optionsOrError }

  const mediaOrError = parseMedia(formData)
  if (typeof mediaOrError === 'string') return { error: mediaOrError }

  try {
    await db.$transaction(async (tx) => {
      await tx.question.update({
        where: { id },
        data: {
          questionText: result.data.questionText,
          type: result.data.type,
          points: result.data.points,
          mediaType: mediaOrError.mediaType,
          mediaUrl: mediaOrError.mediaUrl,
        },
      })
      await tx.questionOption.deleteMany({ where: { questionId: id } })
      if (optionsOrError.length > 0) {
        await tx.questionOption.createMany({
          data: optionsOrError.map((o) => ({ ...o, questionId: id })),
        })
      }
    })
  } catch (err) {
    console.error('[updateQuestion]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath(basePath + '/assessments/' + assessmentId)
  revalidatePath(basePath + '/assessments/' + assessmentId + '/questions/' + id)
  return { error: null, success: true }
}

export async function deleteQuestionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authorize(formData)
  if ('error' in auth) return auth
  const { basePath } = auth

  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return { error: 'Invalid question ID.' }

  const assessmentId = formData.get('assessmentId')
  if (typeof assessmentId !== 'string' || !assessmentId)
    return { error: 'Invalid assessment ID.' }

  const attempts = await countAttempts(assessmentId)
  if (attempts > 0) {
    return {
      error:
        'Questions are locked because students have attempted this assessment.',
    }
  }

  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: { isPublished: true, _count: { select: { questions: true } } },
  })
  if (!assessment) return { error: 'Assessment not found.' }
  if (assessment.isPublished && assessment._count.questions <= 1) {
    return {
      error: 'Cannot delete the last question of a published assessment.',
    }
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.questionOption.deleteMany({ where: { questionId: id } })
      await tx.question.delete({ where: { id } })
    })
  } catch (err) {
    console.error('[deleteQuestion]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath(basePath + '/assessments/' + assessmentId)
  return { error: null, success: true }
}

export async function moveQuestionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authorize(formData)
  if ('error' in auth) return auth
  const { basePath } = auth

  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return { error: 'Invalid question ID.' }

  const assessmentId = formData.get('assessmentId')
  if (typeof assessmentId !== 'string' || !assessmentId)
    return { error: 'Invalid assessment ID.' }

  const direction = formData.get('direction')
  if (direction !== 'up' && direction !== 'down')
    return { error: 'Invalid direction.' }

  const siblings = await db.question.findMany({
    where: { assessmentId },
    orderBy: { order: 'asc' },
    select: { id: true, order: true },
  })

  const idx = siblings.findIndex((q) => q.id === id)
  if (idx === -1) return { error: 'Question not found.' }

  const targetIdx = direction === 'up' ? idx - 1 : idx + 1
  if (targetIdx < 0 || targetIdx >= siblings.length) {
    return { error: null, success: true }
  }

  const current = siblings[idx]
  const neighbor = siblings[targetIdx]

  try {
    await db.$transaction([
      db.question.update({
        where: { id: current.id },
        data: { order: neighbor.order },
      }),
      db.question.update({
        where: { id: neighbor.id },
        data: { order: current.order },
      }),
    ])
  } catch (err) {
    console.error('[moveQuestion]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath(basePath + '/assessments/' + assessmentId)
  return { error: null, success: true }
}
