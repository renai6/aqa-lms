// app/(student)/student/courses/[id]/subjects/[sid]/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

type ActionState = { error: string | null }

export async function markLessonDoneAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const lessonId = formData.get('lessonId')
  const courseId = formData.get('courseId')
  const subjectId = formData.get('subjectId')
  if (typeof lessonId !== 'string' || !lessonId) return { error: 'Invalid lesson.' }
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course.' }
  if (typeof subjectId !== 'string' || !subjectId) return { error: 'Invalid subject.' }

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: session.userId, courseId } },
    select: { id: true },
  })
  if (!enrollment) return { error: 'Not enrolled in this course.' }

  const lesson = await db.lesson.findFirst({
    where: { id: lessonId, subject: { courseId } },
    select: { id: true },
  })
  if (!lesson) return { error: 'Invalid lesson.' }

  await db.lessonCompletion.upsert({
    where: { userId_lessonId: { userId: session.userId, lessonId } },
    create: { userId: session.userId, lessonId },
    update: {},
  })

  revalidatePath('/student/courses/' + courseId + '/subjects/' + subjectId)
  revalidatePath('/student/courses/' + courseId)
  revalidatePath('/student/dashboard')
  return { error: null }
}

export async function unmarkLessonDoneAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const lessonId = formData.get('lessonId')
  const courseId = formData.get('courseId')
  const subjectId = formData.get('subjectId')
  if (typeof lessonId !== 'string' || !lessonId) return { error: 'Invalid lesson.' }
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course.' }
  if (typeof subjectId !== 'string' || !subjectId) return { error: 'Invalid subject.' }

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: session.userId, courseId } },
    select: { id: true },
  })
  if (!enrollment) return { error: 'Not enrolled in this course.' }

  await db.lessonCompletion.deleteMany({
    where: { userId: session.userId, lessonId },
  })

  revalidatePath('/student/courses/' + courseId + '/subjects/' + subjectId)
  revalidatePath('/student/courses/' + courseId)
  revalidatePath('/student/dashboard')
  return { error: null }
}
