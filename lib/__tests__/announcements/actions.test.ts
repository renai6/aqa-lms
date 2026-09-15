import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    announcement: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    course: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/auth/session', () => ({ getSession: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))
vi.mock('@/lib/announcements/storage', () => ({
  uploadAnnouncementImage: vi.fn(),
  removeAnnouncementImage: vi.fn(),
}))

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { saveAnnouncementAction } from '@/lib/announcements/actions'

const initial = { error: null }

function form(fields: Record<string, string | string[] | File>): FormData {
  const fd = new FormData()
  const base = { title: 'Eid break', content: 'Classes resume Monday.', audience: 'EVERYONE', intent: 'save' }
  for (const [key, value] of Object.entries({ ...base, ...fields })) {
    if (Array.isArray(value)) value.forEach((v) => fd.append(key, v))
    else fd.set(key, value)
  }
  return fd
}

function existing(overrides: Record<string, unknown> = {}) {
  return { imageUrl: null, publishedAt: null, courses: [], ...overrides }
}

function createData() {
  return vi.mocked(db.announcement.create).mock.calls[0][0].data as Record<string, unknown>
}

function updateData() {
  return vi.mocked(db.announcement.update).mock.calls[0][0].data as Record<string, unknown>
}

describe('saveAnnouncementAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue({ userId: 'admin1', role: 'ADMIN' } as never)
    vi.mocked(db.announcement.create).mockResolvedValue({ id: 'a1' } as never)
    vi.mocked(db.announcement.update).mockResolvedValue({} as never)
    vi.mocked(db.announcement.findUnique).mockResolvedValue(existing() as never)
    vi.mocked(db.course.findMany).mockResolvedValue([] as never)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('access', () => {
    it('rejects a missing session', async () => {
      vi.mocked(getSession).mockResolvedValue(null as never)
      expect(await saveAnnouncementAction(initial, form({}))).toEqual({ error: 'Unauthorized' })
      expect(db.announcement.create).not.toHaveBeenCalled()
    })

    it('rejects a non-admin', async () => {
      vi.mocked(getSession).mockResolvedValue({ userId: 't1', role: 'TEACHER' } as never)
      expect(await saveAnnouncementAction(initial, form({}))).toEqual({ error: 'Forbidden' })
      expect(db.announcement.create).not.toHaveBeenCalled()
    })

    it('allows a super admin', async () => {
      vi.mocked(getSession).mockResolvedValue({ userId: 's1', role: 'SUPER_ADMIN' } as never)
      await expect(saveAnnouncementAction(initial, form({}))).rejects.toThrow('NEXT_REDIRECT')
      expect(db.announcement.create).toHaveBeenCalled()
    })
  })

  it('returns the validation error without writing', async () => {
    expect(await saveAnnouncementAction(initial, form({ title: '' }))).toEqual({
      error: 'Title is required.',
    })
    expect(db.announcement.create).not.toHaveBeenCalled()
  })

  describe('create', () => {
    it('saves a draft without publishing and redirects to the edit page', async () => {
      await expect(saveAnnouncementAction(initial, form({ isPinned: 'on' }))).rejects.toThrow(
        'NEXT_REDIRECT',
      )
      const data = createData()
      expect(data).toMatchObject({
        title: 'Eid break',
        content: 'Classes resume Monday.',
        audience: 'EVERYONE',
        isPinned: true,
        courses: { create: [] },
      })
      expect(data).not.toHaveProperty('isPublished')
      expect(data).not.toHaveProperty('publishedAt')
      expect(redirect).toHaveBeenCalledWith('/admin/announcements/a1?created=1')
      expect(revalidatePath).toHaveBeenCalledWith('/admin/announcements')
      expect(revalidatePath).toHaveBeenCalledWith('/admin/announcements/a1')
      expect(revalidatePath).toHaveBeenCalledWith('/student/dashboard')
      expect(revalidatePath).toHaveBeenCalledWith('/student/announcements')
    })

    it('publishes with a publish date', async () => {
      await expect(saveAnnouncementAction(initial, form({ intent: 'publish' }))).rejects.toThrow(
        'NEXT_REDIRECT',
      )
      const data = createData()
      expect(data.isPublished).toBe(true)
      expect(data.publishedAt).toBeInstanceOf(Date)
    })

    it('links the selected courses', async () => {
      vi.mocked(db.course.findMany).mockResolvedValue([
        { id: 'c1', archivedAt: null },
        { id: 'c2', archivedAt: null },
      ] as never)
      await expect(
        saveAnnouncementAction(initial, form({ audience: 'COURSES', courseIds: ['c1', 'c2'] })),
      ).rejects.toThrow('NEXT_REDIRECT')
      expect(createData().courses).toEqual({ create: [{ courseId: 'c1' }, { courseId: 'c2' }] })
    })

    it('rejects an unknown course', async () => {
      vi.mocked(db.course.findMany).mockResolvedValue([] as never)
      expect(
        await saveAnnouncementAction(initial, form({ audience: 'COURSES', courseIds: ['c1'] })),
      ).toEqual({ error: 'One or more selected courses are no longer available.' })
      expect(db.announcement.create).not.toHaveBeenCalled()
    })

    it('rejects a newly selected archived course', async () => {
      vi.mocked(db.course.findMany).mockResolvedValue([{ id: 'c1', archivedAt: new Date() }] as never)
      expect(
        await saveAnnouncementAction(initial, form({ audience: 'COURSES', courseIds: ['c1'] })),
      ).toEqual({ error: 'One or more selected courses are no longer available.' })
    })

    it('returns a friendly error when the database write fails', async () => {
      vi.mocked(db.announcement.create).mockRejectedValue(new Error('db down'))
      expect(await saveAnnouncementAction(initial, form({}))).toEqual({
        error: 'A database error occurred. Please try again.',
      })
    })
  })

  describe('update', () => {
    it('fails when the announcement no longer exists', async () => {
      vi.mocked(db.announcement.findUnique).mockResolvedValue(null as never)
      expect(await saveAnnouncementAction(initial, form({ id: 'gone' }))).toEqual({
        error: 'Announcement not found.',
      })
      expect(db.announcement.update).not.toHaveBeenCalled()
    })

    it('replaces the course list in the same write', async () => {
      vi.mocked(db.course.findMany).mockResolvedValue([{ id: 'c2', archivedAt: null }] as never)
      const result = await saveAnnouncementAction(
        initial,
        form({ id: 'a1', audience: 'COURSES', courseIds: ['c2'] }),
      )
      expect(result).toEqual({ error: null, message: 'Saved.' })
      expect(vi.mocked(db.announcement.update).mock.calls[0][0].where).toEqual({ id: 'a1' })
      expect(updateData().courses).toEqual({ deleteMany: {}, create: [{ courseId: 'c2' }] })
      expect(redirect).not.toHaveBeenCalled()
      expect(revalidatePath).toHaveBeenCalledWith('/admin/announcements')
      expect(revalidatePath).toHaveBeenCalledWith('/admin/announcements/a1')
    })

    it('clears the courses when switching to everyone', async () => {
      vi.mocked(db.announcement.findUnique).mockResolvedValue(
        existing({ courses: [{ courseId: 'c1' }] }) as never,
      )
      await saveAnnouncementAction(initial, form({ id: 'a1', audience: 'EVERYONE', courseIds: ['c1'] }))
      expect(updateData().courses).toEqual({ deleteMany: {}, create: [] })
      expect(db.course.findMany).not.toHaveBeenCalled()
    })

    it('keeps an archived course that was already attached', async () => {
      vi.mocked(db.announcement.findUnique).mockResolvedValue(
        existing({ courses: [{ courseId: 'c1' }] }) as never,
      )
      vi.mocked(db.course.findMany).mockResolvedValue([{ id: 'c1', archivedAt: new Date() }] as never)
      const result = await saveAnnouncementAction(
        initial,
        form({ id: 'a1', audience: 'COURSES', courseIds: ['c1'] }),
      )
      expect(result).toEqual({ error: null, message: 'Saved.' })
    })

    it('saving leaves the published state alone', async () => {
      await saveAnnouncementAction(initial, form({ id: 'a1' }))
      expect(updateData()).not.toHaveProperty('isPublished')
      expect(updateData()).not.toHaveProperty('publishedAt')
    })

    it('keeps the first publish date when republishing', async () => {
      const first = new Date('2026-09-01T00:00:00Z')
      vi.mocked(db.announcement.findUnique).mockResolvedValue(existing({ publishedAt: first }) as never)
      const result = await saveAnnouncementAction(initial, form({ id: 'a1', intent: 'publish' }))
      expect(result).toEqual({ error: null, message: 'Published.' })
      expect(updateData()).toMatchObject({ isPublished: true, publishedAt: first })
    })

    it('unpublishes without touching the publish date', async () => {
      const result = await saveAnnouncementAction(initial, form({ id: 'a1', intent: 'unpublish' }))
      expect(result).toEqual({ error: null, message: 'Unpublished.' })
      expect(updateData().isPublished).toBe(false)
      expect(updateData()).not.toHaveProperty('publishedAt')
    })
  })
})
