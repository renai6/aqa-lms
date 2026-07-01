'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { getMaxBatchNumber, nextBatchNumber } from './queries'

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
      await tx.batch.create({
        data: { courseId, number: newNumber, isActive: true },
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
    recordingUrl: z.string().optional(),
  })
  const result = schema.safeParse({
    materialUrl: formData.get('materialUrl'),
    recordingUrl: formData.get('recordingUrl'),
  })
  if (!result.success) return { error: result.error.issues[0]?.message ?? 'Validation failed.' }

  try {
    await db.batchLessonContent.upsert({
      where: { batchId_lessonId: { batchId, lessonId } },
      create: {
        batchId,
        lessonId,
        materialUrl: result.data.materialUrl || null,
        recordingUrl: result.data.recordingUrl || null,
      },
      update: {
        materialUrl: result.data.materialUrl || null,
        recordingUrl: result.data.recordingUrl || null,
      },
    })
  } catch (err) {
    console.error('[upsertBatchLessonContent]', err)
    return { error: 'A database error occurred.' }
  }

  revalidatePath('/admin/courses/' + courseId + '/batches/' + batchId)
  return { error: null, success: true }
}
