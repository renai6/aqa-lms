'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

type ActionState = { error: string | null; success?: boolean }

const MIME_EXTS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const

const MAGIC_BYTES: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

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
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
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

export async function uploadCourseImageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  const courseId = formData.get('courseId')
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course ID.' }

  const courseExists = await db.course.findUnique({ where: { id: courseId }, select: { id: true, imageUrl: true } })
  if (!courseExists) return { error: 'Course not found.' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Please select an image file.' }

  if (!(file.type in MIME_EXTS)) {
    return { error: 'Only JPEG, PNG, and WebP images are allowed.' }
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return { error: 'Image must be 10 MB or smaller.' }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const magic = MAGIC_BYTES[file.type]!
  if (!magic.every((byte, i) => buffer[i] === byte)) {
    return { error: 'File content does not match its declared type.' }
  }

  if (file.type === 'image/webp') {
    const webpMarker = [0x57, 0x45, 0x42, 0x50]
    if (!webpMarker.every((byte, i) => buffer[i + 8] === byte)) {
      return { error: 'File content does not match its declared type.' }
    }
  }

  const ext = MIME_EXTS[file.type as keyof typeof MIME_EXTS]
  const storagePath = `courses/${courseId}/image.${ext}`
  const bucket = process.env.SUPABASE_COURSE_IMAGES_BUCKET!

  if (courseExists.imageUrl) {
    const oldExt = new URL(courseExists.imageUrl).pathname.split('.').pop()
    if (oldExt && oldExt !== ext) {
      await supabaseAdmin.storage.from(bucket).remove([`courses/${courseId}/image.${oldExt}`])
    }
  }

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(storagePath, buffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    console.error('[uploadCourseImage]', uploadError)
    return { error: 'Failed to upload image. Please try again.' }
  }

  const { data: { publicUrl } } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath)

  try {
    await db.course.update({ where: { id: courseId }, data: { imageUrl: publicUrl } })
  } catch (err) {
    console.error('[uploadCourseImage] db', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/courses')
  revalidatePath('/admin/courses/' + courseId)
  revalidatePath('/courses')
  return { error: null, success: true }
}

export async function removeCourseImageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  const courseId = formData.get('courseId')
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course ID.' }

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { imageUrl: true },
  })
  if (!course?.imageUrl) return { error: 'No image to remove.' }

  const ext = new URL(course.imageUrl).pathname.split('.').pop()
  const storagePath = `courses/${courseId}/image.${ext}`
  const bucket = process.env.SUPABASE_COURSE_IMAGES_BUCKET!

  const { error: removeError } = await supabaseAdmin.storage.from(bucket).remove([storagePath])
  if (removeError) {
    console.error('[removeCourseImage]', removeError)
    return { error: 'Failed to remove image. Please try again.' }
  }

  try {
    await db.course.update({ where: { id: courseId }, data: { imageUrl: null } })
  } catch (err) {
    console.error('[removeCourseImage] db', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/courses')
  revalidatePath('/admin/courses/' + courseId)
  revalidatePath('/courses')
  return { error: null, success: true }
}
