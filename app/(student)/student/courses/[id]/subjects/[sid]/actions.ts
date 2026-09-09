// app/(student)/student/courses/[id]/subjects/[sid]/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { isActiveStudent } from '@/lib/auth/capabilities'
import { ACTIVE_COURSE } from '@/lib/courses/archive'
import { ACTIVE_ENROLLMENT } from '@/lib/enrollments/active'
import { getLessonGateState } from '@/lib/lessons/queries'

type ActionState = { error: string | null }

export async function markLessonDoneAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!(await isActiveStudent(session))) return { error: 'Your account is inactive.' }

  const lessonId = formData.get('lessonId')
  const courseId = formData.get('courseId')
  const subjectId = formData.get('subjectId')
  if (typeof lessonId !== 'string' || !lessonId) return { error: 'Invalid lesson.' }
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course.' }
  if (typeof subjectId !== 'string' || !subjectId) return { error: 'Invalid subject.' }

  const enrollment = await db.enrollment.findUnique({
    where: {
      userId_courseId: { userId: session.userId, courseId },
      ...ACTIVE_ENROLLMENT,
      course: { ...ACTIVE_COURSE },
    },
    select: { id: true },
  })
  if (!enrollment) return { error: 'Not enrolled in this course.' }

  const lesson = await db.lesson.findFirst({
    where: { id: lessonId, subject: { courseId } },
    select: { id: true },
  })
  if (!lesson) return { error: 'Invalid lesson.' }

  const gateState = await getLessonGateState(session.userId, lessonId)
  if (gateState == null) return { error: 'Invalid lesson.' }
  if (gateState.isLocked) return { error: 'This lesson is locked.' }
  // Where a gate exists, passing it is the only way to become done. Two routes
  // to "done" would let progress and unlock state disagree.
  if (gateState.hasGate) {
    return { error: "Pass this lesson's assessment to complete it." }
  }

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
  if (!(await isActiveStudent(session))) return { error: 'Your account is inactive.' }

  const lessonId = formData.get('lessonId')
  const courseId = formData.get('courseId')
  const subjectId = formData.get('subjectId')
  if (typeof lessonId !== 'string' || !lessonId) return { error: 'Invalid lesson.' }
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course.' }
  if (typeof subjectId !== 'string' || !subjectId) return { error: 'Invalid subject.' }

  const enrollment = await db.enrollment.findUnique({
    where: {
      userId_courseId: { userId: session.userId, courseId },
      ...ACTIVE_ENROLLMENT,
      course: { ...ACTIVE_COURSE },
    },
    select: { id: true },
  })
  if (!enrollment) return { error: 'Not enrolled in this course.' }

  const gateState = await getLessonGateState(session.userId, lessonId)
  // Un-ticking a gated lesson would re-lock everything after it.
  if (gateState?.hasGate) {
    return { error: "Pass this lesson's assessment to complete it." }
  }

  await db.lessonCompletion.deleteMany({
    where: { userId: session.userId, lessonId },
  })

  revalidatePath('/student/courses/' + courseId + '/subjects/' + subjectId)
  revalidatePath('/student/courses/' + courseId)
  revalidatePath('/student/dashboard')
  return { error: null }
}
