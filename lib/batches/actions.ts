'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { getMaxBatchNumber, nextBatchNumber } from './queries'
import { generateBatchName } from './name'
import { toPreviewUrl } from './drive'

type ActionState = { error: string | null; success?: boolean }

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { ok: false as const, error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    return { ok: false as const, error: 'Forbidden' }
  }
  return { ok: true as const }
}

export async function startNewBatchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const courseId = formData.get('courseId')
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course ID.' }

  const auth = await requireAdmin()
  if (!auth.ok) return { error: auth.error }

  try {
    const maxNumber = await getMaxBatchNumber(courseId)
    const newNumber = nextBatchNumber(maxNumber)
    await db.$transaction(async (tx) => {
      await tx.batch.updateMany({
        where: { courseId, isActive: true },
        data: { isActive: false },
      })
      const course = await tx.course.findUnique({
        where: { id: courseId },
        select: { courseAlias: true },
      })
      await tx.batch.create({
        data: {
          courseId,
          number: newNumber,
          isActive: true,
          name: generateBatchName(course?.courseAlias ?? null, new Date()),
        },
      })
    })
  } catch (err) {
    console.error('[startNewBatch]', err)
    return { error: 'A database error occurred.' }
  }

  revalidatePath('/admin/courses/' + courseId)
  revalidatePath('/admin/courses/' + courseId + '/batches')
  return { error: null, success: true }
}

export async function upsertBatchLessonContentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const batchId = formData.get('batchId')
  const lessonId = formData.get('lessonId')
  const courseId = formData.get('courseId')
  if (typeof batchId !== 'string' || !batchId) return { error: 'Invalid batch ID.' }
  if (typeof lessonId !== 'string' || !lessonId) return { error: 'Invalid lesson ID.' }
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course ID.' }

  const auth = await requireAdmin()
  if (!auth.ok) return { error: auth.error }

  const schema = z.object({
    materialUrl: z.string().optional(),
    videoUrl: z.string().optional(),
    audioUrl: z.string().optional(),
    pptUrl: z.string().optional(),
  })
  const result = schema.safeParse({
    materialUrl: formData.get('materialUrl'),
    videoUrl: formData.get('videoUrl'),
    audioUrl: formData.get('audioUrl'),
    pptUrl: formData.get('pptUrl'),
  })
  if (!result.success) return { error: result.error.issues[0]?.message ?? 'Validation failed.' }

  if (result.data.videoUrl && !toPreviewUrl(result.data.videoUrl)) {
    return { error: 'Lesson Video URL must be a Google Drive file link.' }
  }
  if (result.data.audioUrl && !toPreviewUrl(result.data.audioUrl)) {
    return { error: 'Audio URL must be a Google Drive file link.' }
  }
  // pptUrl is deliberately unvalidated: decks arrive from Drive, OneDrive and
  // SharePoint alike, and rejecting a working link is worse than opening one
  // in a new tab.

  const content = {
    materialUrl: result.data.materialUrl || null,
    videoUrl: result.data.videoUrl || null,
    audioUrl: result.data.audioUrl || null,
    pptUrl: result.data.pptUrl || null,
  }

  try {
    await db.batchLessonContent.upsert({
      where: { batchId_lessonId: { batchId, lessonId } },
      create: { batchId, lessonId, ...content },
      update: content,
    })
  } catch (err) {
    console.error('[upsertBatchLessonContent]', err)
    return { error: 'A database error occurred.' }
  }

  revalidatePath('/admin/courses/' + courseId + '/batches/' + batchId)
  return { error: null, success: true }
}

// A class date is a calendar day, not an instant. Parsing it as UTC midnight
// keeps the @db.Date column holding the day the admin actually typed, whatever
// the server's own offset is.
function parseClassDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(value + 'T00:00:00.000Z')
  return Number.isNaN(date.getTime()) ? null : date
}

export async function addBatchRecordingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const batchId = formData.get('batchId')
  const subjectId = formData.get('subjectId')
  const courseId = formData.get('courseId')
  if (typeof batchId !== 'string' || !batchId) return { error: 'Invalid batch ID.' }
  if (typeof subjectId !== 'string' || !subjectId) return { error: 'Invalid subject ID.' }
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course ID.' }

  const auth = await requireAdmin()
  if (!auth.ok) return { error: auth.error }

  const url = formData.get('url')
  if (typeof url !== 'string' || !toPreviewUrl(url)) {
    return { error: 'Recording URL must be a Google Drive file link.' }
  }

  const date = parseClassDate(formData.get('date'))
  if (!date) return { error: 'Recording date is required.' }

  const rawTitle = formData.get('title')
  const title = typeof rawTitle === 'string' ? rawTitle.trim() : ''

  try {
    await db.batchRecording.create({
      data: { batchId, subjectId, url, date, title: title || null },
    })
  } catch (err) {
    console.error('[addBatchRecording]', err)
    return { error: 'A database error occurred.' }
  }

  revalidatePath('/admin/courses/' + courseId + '/batches/' + batchId)
  return { error: null, success: true }
}

export async function removeBatchRecordingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const recordingId = formData.get('recordingId')
  const batchId = formData.get('batchId')
  const courseId = formData.get('courseId')
  if (typeof recordingId !== 'string' || !recordingId) return { error: 'Invalid recording ID.' }
  if (typeof batchId !== 'string' || !batchId) return { error: 'Invalid batch ID.' }
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course ID.' }

  const auth = await requireAdmin()
  if (!auth.ok) return { error: auth.error }

  try {
    await db.batchRecording.delete({ where: { id: recordingId } })
  } catch (err) {
    console.error('[removeBatchRecording]', err)
    return { error: 'A database error occurred.' }
  }

  revalidatePath('/admin/courses/' + courseId + '/batches/' + batchId)
  return { error: null, success: true }
}
