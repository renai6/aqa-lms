'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { DayOfWeek } from '@prisma/client'

type ActionState = { error: string | null; success?: boolean; warning?: string }

const subjectSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  description: z.string().optional(),
  order: z.coerce.number().int().min(1, 'Order must be at least 1.'),
  units: z.coerce.number().int().min(1, 'Units must be at least 1.').default(1),
  // "" from the "Everyone" option maps to null (visible to all).
  gender: z.preprocess(
    (v) => (v === '' || v == null ? null : v),
    z.enum(['MALE', 'FEMALE']).nullable(),
  ),
})

const ALL_DAYS = [
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
] as const

const scheduleSchema = z.object({
  day: z.enum(ALL_DAYS),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid start time format.'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid end time format.'),
})

export async function createSubjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  const courseId = formData.get('courseId')
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course ID.' }

  const raw = {
    title: formData.get('title'),
    description: formData.get('description'),
    order: formData.get('order') ?? '1',
    units: formData.get('units') ?? '1',
    gender: formData.get('gender'),
  }

  const result = subjectSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed.' }
  }

  const { title, description, order, units, gender } = result.data

  try {
    await db.subject.create({
      data: { courseId, title, description: description || null, order, units, gender },
    })
  } catch (err) {
    console.error('[createSubject]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/courses/' + courseId + '/subjects')
  redirect('/admin/courses/' + courseId + '/subjects')
}

export async function updateSubjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return { error: 'Invalid subject ID.' }

  const courseId = formData.get('courseId')
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course ID.' }

  const raw = {
    title: formData.get('title'),
    description: formData.get('description'),
    order: formData.get('order') ?? '1',
    units: formData.get('units') ?? '1',
    gender: formData.get('gender'),
  }

  const result = subjectSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed.' }
  }

  const { title, description, order, units, gender } = result.data
  const confirmed = formData.get('confirm') === 'true'

  // When restricting to a gender, warn (once) if enrollees of a different
  // gender already have attempts or grades here and would lose access (D6).
  const current = await db.subject.findUnique({ where: { id }, select: { gender: true } })
  const genderChanged = (current?.gender ?? null) !== gender
  if (genderChanged && gender != null && !confirmed) {
    const affected = await db.user.count({
      where: {
        AND: [
          { enrollments: { some: { courseId } } },
          // Everyone who will lose access: a different gender OR unknown gender
          // (null !== the restricted gender is treated as excluded, fail-closed).
          { OR: [{ gender: null }, { gender: { not: gender } }] },
          {
            OR: [
              { attempts: { some: { assessment: { subjectId: id } } } },
              { grades: { some: { subjectId: id } } },
            ],
          },
        ],
      },
    })
    if (affected > 0) {
      const noun = affected === 1 ? 'student' : 'students'
      return {
        error: null,
        warning: `${affected} ${noun} of a different gender have attempts or grades in this subject and will lose access. Confirm to proceed.`,
      }
    }
  }

  try {
    await db.subject.update({
      where: { id },
      data: { title, description: description || null, order, units, gender },
    })
  } catch (err) {
    console.error('[updateSubject]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/courses/' + courseId)
  revalidatePath('/admin/courses/' + courseId + '/subjects/' + id)
  return { error: null, success: true }
}

export async function deleteSubjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return { error: 'Invalid subject ID.' }

  const courseId = formData.get('courseId')
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course ID.' }

  try {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.lesson.deleteMany({ where: { subjectId: id } })
      await tx.subject.delete({ where: { id } })
    })
  } catch (err) {
    console.error('[deleteSubject]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/courses/' + courseId + '/subjects')
  redirect('/admin/courses/' + courseId + '/subjects')
}

export async function copySubjectToCourseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  const subjectId = formData.get('subjectId')
  if (typeof subjectId !== 'string' || !subjectId) return { error: 'Invalid subject ID.' }

  const targetCourseId = formData.get('targetCourseId')
  if (typeof targetCourseId !== 'string' || !targetCourseId) {
    return { error: 'Please select a target course.' }
  }

  // Copy the subject metadata plus its lessons and schedules (not assessments,
  // teacher assignments, or any student data).
  const source = await db.subject.findUnique({
    where: { id: subjectId },
    select: {
      title: true,
      description: true,
      units: true,
      gender: true,
      courseId: true,
      lessons: { select: { title: true, description: true, order: true } },
      schedules: { select: { day: true, startTime: true, endTime: true } },
    },
  })
  if (!source) return { error: 'Subject not found.' }

  if (targetCourseId === source.courseId) {
    return { error: 'Choose a course other than the one this subject is already in.' }
  }

  const targetCourse = await db.course.findUnique({
    where: { id: targetCourseId },
    select: { id: true },
  })
  if (!targetCourse) return { error: 'Target course not found.' }

  try {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      // Append after the target course's existing subjects.
      const max = await tx.subject.aggregate({
        where: { courseId: targetCourseId },
        _max: { order: true },
      })
      const order = (max._max.order ?? 0) + 1

      await tx.subject.create({
        data: {
          courseId: targetCourseId,
          title: source.title,
          description: source.description,
          units: source.units,
          gender: source.gender,
          order,
          lessons: { create: source.lessons },
          schedules: { create: source.schedules },
        },
      })
    })
  } catch (err) {
    console.error('[copySubjectToCourse]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/courses/' + targetCourseId + '/subjects')
  redirect('/admin/courses/' + targetCourseId + '/subjects')
}

export async function assignTeacherAction(
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

  const userId = formData.get('userId')
  if (typeof userId !== 'string' || !userId) return { error: 'Please select a teacher.' }

  try {
    await db.subjectTeacher.upsert({
      where: { subjectId_userId: { subjectId, userId } },
      create: { subjectId, userId },
      update: {},
    })
  } catch (err) {
    console.error('[assignTeacher]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/courses/' + courseId + '/subjects/' + subjectId)
  return { error: null }
}

export async function removeTeacherAction(
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

  const userId = formData.get('userId')
  if (typeof userId !== 'string' || !userId) return { error: 'Invalid user ID.' }

  try {
    await db.subjectTeacher.delete({
      where: { subjectId_userId: { subjectId, userId } },
    })
  } catch (err) {
    console.error('[removeTeacher]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/courses/' + courseId + '/subjects/' + subjectId)
  return { error: null }
}

export async function addScheduleAction(
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
    day: formData.get('day'),
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
  }

  const result = scheduleSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed.' }
  }

  const { day, startTime, endTime } = result.data
  if (startTime >= endTime) {
    return { error: 'Start time must be before end time.' }
  }

  try {
    await db.subjectSchedule.create({
      data: { subjectId, day: day as DayOfWeek, startTime, endTime },
    })
  } catch (err) {
    console.error('[addSchedule]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/courses/' + courseId + '/subjects/' + subjectId)
  return { error: null, success: true }
}

export async function removeScheduleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  const scheduleId = formData.get('scheduleId')
  if (typeof scheduleId !== 'string' || !scheduleId) return { error: 'Invalid schedule ID.' }

  const subjectId = formData.get('subjectId')
  if (typeof subjectId !== 'string' || !subjectId) return { error: 'Invalid subject ID.' }

  const courseId = formData.get('courseId')
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course ID.' }

  try {
    await db.subjectSchedule.delete({ where: { id: scheduleId, subjectId } })
  } catch (err) {
    console.error('[removeSchedule]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/courses/' + courseId + '/subjects/' + subjectId)
  return { error: null }
}
