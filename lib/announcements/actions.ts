'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { validateImageUpload } from '@/lib/uploads/image'
import { parseAnnouncementForm } from './validation'
import { removeAnnouncementImage, uploadAnnouncementImage } from './storage'

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

  const file = formData.get('image')
  const hasFile = file instanceof File && file.size > 0
  const image = hasFile ? await validateImageUpload(file) : null
  if (image && !image.ok) return { error: image.error }

  // The reads run in their own try/catch, so a transient database error
  // returns the friendly message instead of throwing out of the action.
  const read = await (async () => {
    try {
      const existing = input.id
        ? await db.announcement.findUnique({
            where: { id: input.id },
            select: { imageUrl: true, publishedAt: true, courses: { select: { courseId: true } } },
          })
        : null
      if (input.id && !existing) return { ok: false as const, error: 'Announcement not found.' }

      const courseIds = input.audience === 'COURSES' ? input.courseIds : []
      if (courseIds.length > 0) {
        // An archived course may stay only if it was already attached; it
        // cannot be newly targeted.
        const attached = new Set(existing?.courses.map((c) => c.courseId))
        const found = await db.course.findMany({
          where: { id: { in: courseIds } },
          select: { id: true, archivedAt: true },
        })
        const usable = found.filter((c) => c.archivedAt === null || attached.has(c.id))
        if (usable.length !== courseIds.length) {
          return { ok: false as const, error: 'One or more selected courses are no longer available.' }
        }
      }
      return { ok: true as const, existing, courseIds }
    } catch (err) {
      console.error('[saveAnnouncement] db read', err)
      return { ok: false as const, error: 'A database error occurred. Please try again.' }
    }
  })()
  if (!read.ok) return { error: read.error }
  const { existing, courseIds } = read

  // Upload before writing, so the row never points at a file that does not
  // exist. If the write then fails, the new file is removed again.
  let uploadedUrl: string | null = null
  if (image?.ok) {
    try {
      uploadedUrl = await uploadAnnouncementImage(image)
    } catch (err) {
      console.error('[saveAnnouncement] upload', err)
      return { error: 'Failed to upload image. Please try again.' }
    }
  }

  const oldImageUrl = existing?.imageUrl ?? null
  const imageUrl = uploadedUrl ?? (input.removeImage ? null : oldImageUrl)

  const data = {
    title: input.title,
    content: input.content,
    audience: input.audience,
    isPinned: input.isPinned,
    imageUrl,
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
    if (uploadedUrl) await removeAnnouncementImage(uploadedUrl)
    return { error: 'A database error occurred. Please try again.' }
  }

  // Only now is the old file unreferenced.
  if (oldImageUrl && oldImageUrl !== imageUrl) await removeAnnouncementImage(oldImageUrl)

  revalidateAnnouncements(id)
  if (!input.id) redirect(`/admin/announcements/${id}?created=1`)
  return { error: null, message: SUCCESS_MESSAGE[input.intent] }
}

export async function deleteAnnouncementAction(
  _prev: AnnouncementActionState,
  formData: FormData,
): Promise<AnnouncementActionState> {
  const denied = await denyUnlessAdmin()
  if (denied) return { error: denied }

  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return { error: 'Invalid announcement ID.' }

  const read = await (async () => {
    try {
      const announcement = await db.announcement.findUnique({
        where: { id },
        select: { imageUrl: true },
      })
      return { ok: true as const, announcement }
    } catch (err) {
      console.error('[deleteAnnouncement] db read', err)
      return { ok: false as const }
    }
  })()
  if (!read.ok) return { error: 'A database error occurred. Please try again.' }
  const { announcement } = read
  if (!announcement) return { error: 'Announcement not found.' }

  try {
    // Course links cascade with the row.
    await db.announcement.delete({ where: { id } })
  } catch (err) {
    console.error('[deleteAnnouncement] db', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  if (announcement.imageUrl) await removeAnnouncementImage(announcement.imageUrl)

  revalidateAnnouncements()
  redirect('/admin/announcements')
}
