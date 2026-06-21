'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

type ActionState = { error: string | null; success?: boolean }

const courseSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  description: z.string().optional(),
  passingGrade: z.coerce.number().min(0, 'Must be at least 0.').max(100, 'Must be at most 100.'),
})

export async function createCourseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  const raw = {
    title: formData.get('title'),
    description: formData.get('description'),
    passingGrade: formData.get('passingGrade') ?? '75',
  }

  const result = courseSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed.' }
  }

  const { title, description, passingGrade } = result.data

  let newCourse: { id: string }
  try {
    newCourse = await db.course.create({
      data: { title, description: description || null, passingGrade },
      select: { id: true },
    })
  } catch (err) {
    console.error('[createCourse]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/courses')
  redirect('/admin/courses/' + newCourse.id)
}

export async function updateCourseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return { error: 'Invalid course ID.' }

  const raw = {
    title: formData.get('title'),
    description: formData.get('description'),
    passingGrade: formData.get('passingGrade') ?? '75',
  }

  const result = courseSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed.' }
  }

  const { title, description, passingGrade } = result.data

  try {
    await db.course.update({
      where: { id },
      data: { title, description: description || null, passingGrade },
    })
  } catch (err) {
    console.error('[updateCourse]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/courses')
  revalidatePath('/admin/courses/' + id)
  return { error: null, success: true }
}

export async function deleteCourseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return { error: 'Invalid course ID.' }

  try {
    await db.$transaction(async (tx) => {
      const subjects = await tx.subject.findMany({ where: { courseId: id }, select: { id: true } })
      const subjectIds = subjects.map(s => s.id)
      await tx.lesson.deleteMany({ where: { subjectId: { in: subjectIds } } })
      await tx.subject.deleteMany({ where: { courseId: id } })
      await tx.course.delete({ where: { id } })
    })
  } catch (err) {
    console.error('[deleteCourse]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/courses')
  redirect('/admin/courses')
}

export async function togglePublishedAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return { error: 'Invalid course ID.' }

  const currentValue = formData.get('currentValue')
  const next = currentValue !== 'true'

  try {
    await db.course.update({ where: { id }, data: { isPublished: next } })
  } catch (err) {
    console.error('[togglePublished]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/courses')
  revalidatePath('/admin/courses/' + id)
  return { error: null }
}
