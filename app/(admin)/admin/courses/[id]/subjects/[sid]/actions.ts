'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

type ActionState = { error: string | null; success?: boolean }

const lessonSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  description: z.string().optional(),
  order: z.coerce.number().int().min(1, 'Order must be at least 1.'),
  materialUrl: z.string().optional(),
  recordingUrl: z.string().optional(),
})

export async function createLessonAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  const subjectId = formData.get('subjectId')
  if (typeof subjectId !== 'string' || !subjectId) return { error: 'Invalid subject ID.' }

  const courseId = formData.get('courseId')
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course ID.' }

  const raw = {
    title: formData.get('title'),
    description: formData.get('description'),
    order: formData.get('order') ?? '1',
    materialUrl: formData.get('materialUrl'),
    recordingUrl: formData.get('recordingUrl'),
  }

  const result = lessonSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed.' }
  }

  const { title, description, order, materialUrl, recordingUrl } = result.data

  try {
    await db.lesson.create({
      data: {
        subjectId,
        title,
        description: description || null,
        order,
        materialUrl: materialUrl || null,
        recordingUrl: recordingUrl || null,
      },
    })
  } catch (err) {
    console.error('[createLesson]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/courses/' + courseId + '/subjects/' + subjectId)
  return { error: null, success: true }
}

export async function updateLessonAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return { error: 'Invalid lesson ID.' }

  const subjectId = formData.get('subjectId')
  if (typeof subjectId !== 'string' || !subjectId) return { error: 'Invalid subject ID.' }

  const courseId = formData.get('courseId')
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course ID.' }

  const raw = {
    title: formData.get('title'),
    description: formData.get('description'),
    order: formData.get('order') ?? '1',
    materialUrl: formData.get('materialUrl'),
    recordingUrl: formData.get('recordingUrl'),
  }

  const result = lessonSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed.' }
  }

  const { title, description, order, materialUrl, recordingUrl } = result.data

  try {
    await db.lesson.update({
      where: { id },
      data: {
        title,
        description: description || null,
        order,
        materialUrl: materialUrl || null,
        recordingUrl: recordingUrl || null,
      },
    })
  } catch (err) {
    console.error('[updateLesson]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/courses/' + courseId + '/subjects/' + subjectId)
  revalidatePath('/admin/courses/' + courseId + '/subjects/' + subjectId + '/lessons/' + id)
  return { error: null, success: true }
}

export async function deleteLessonAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return { error: 'Invalid lesson ID.' }

  const subjectId = formData.get('subjectId')
  if (typeof subjectId !== 'string' || !subjectId) return { error: 'Invalid subject ID.' }

  const courseId = formData.get('courseId')
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course ID.' }

  try {
    await db.lesson.delete({ where: { id } })
  } catch (err) {
    console.error('[deleteLesson]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/courses/' + courseId + '/subjects/' + subjectId)
  redirect('/admin/courses/' + courseId + '/subjects/' + subjectId)
}
