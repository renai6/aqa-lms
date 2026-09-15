'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { parseAnnouncementForm } from './validation'

export type AnnouncementActionState = { error: string | null; message?: string }

async function denyUnlessAdmin(): Promise<string | null> {
  const session = await getSession()
  if (!session) return 'Unauthorized'
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return 'Forbidden'
  return null
}

function revalidateAnnouncements(id?: string) {
  revalidatePath('/admin/announcements')
  if (id) revalidatePath(`/admin/announcements/${id}`)
  revalidatePath('/student/dashboard')
  revalidatePath('/student/announcements')
}

const SUCCESS_MESSAGE = { save: 'Saved.', publish: 'Published.', unpublish: 'Unpublished.' } as const

export async function saveAnnouncementAction(
  _prev: AnnouncementActionState,
  formData: FormData,
): Promise<AnnouncementActionState> {
  const denied = await denyUnlessAdmin()
  if (denied) return { error: denied }

  const parsed = parseAnnouncementForm(formData)
  if (!parsed.ok) return { error: parsed.error }
  const input = parsed.data

  const existing = input.id
    ? await db.announcement.findUnique({
        where: { id: input.id },
        select: { imageUrl: true, publishedAt: true, courses: { select: { courseId: true } } },
      })
    : null
  if (input.id && !existing) return { error: 'Announcement not found.' }

  const courseIds = input.audience === 'COURSES' ? input.courseIds : []
  if (courseIds.length > 0) {
    // An archived course may stay only if it was already attached; it cannot
    // be newly targeted.
    const attached = new Set(existing?.courses.map((c) => c.courseId))
    const found = await db.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, archivedAt: true },
    })
    const usable = found.filter((c) => c.archivedAt === null || attached.has(c.id))
    if (usable.length !== courseIds.length) {
      return { error: 'One or more selected courses are no longer available.' }
    }
  }

  const data = {
    title: input.title,
    content: input.content,
    audience: input.audience,
    isPinned: input.isPinned,
    ...(input.intent === 'publish' && {
      isPublished: true,
      publishedAt: existing?.publishedAt ?? new Date(),
    }),
    ...(input.intent === 'unpublish' && { isPublished: false }),
  }
  const courseRows = courseIds.map((courseId) => ({ courseId }))

  let id: string
  try {
    if (input.id) {
      // Nested writes run in one transaction, so the course list is never
      // left half replaced.
      await db.announcement.update({
        where: { id: input.id },
        data: { ...data, courses: { deleteMany: {}, create: courseRows } },
      })
      id = input.id
    } else {
      const created = await db.announcement.create({
        data: { ...data, courses: { create: courseRows } },
        select: { id: true },
      })
      id = created.id
    }
  } catch (err) {
    console.error('[saveAnnouncement] db', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidateAnnouncements(id)
  if (!input.id) redirect(`/admin/announcements/${id}?created=1`)
  return { error: null, message: SUCCESS_MESSAGE[input.intent] }
}
