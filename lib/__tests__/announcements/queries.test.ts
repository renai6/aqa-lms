import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    announcement: { findMany: vi.fn(), findUnique: vi.fn() },
    course: { findMany: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import {
  getStudentAnnouncements,
  getAdminAnnouncements,
  getAnnouncementForEdit,
  getAnnouncementCourseOptions,
} from '@/lib/announcements/queries'

describe('announcement queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.announcement.findMany).mockResolvedValue([] as never)
    vi.mocked(db.course.findMany).mockResolvedValue([] as never)
  })

  describe('getStudentAnnouncements', () => {
    it('shows published announcements for everyone or an active enrollment in an active course', async () => {
      await getStudentAnnouncements('u1')
      const arg = vi.mocked(db.announcement.findMany).mock.calls[0][0]!
      expect(arg.where).toEqual({
        isPublished: true,
        OR: [
          { audience: 'EVERYONE' },
          {
            courses: {
              some: {
                course: {
                  archivedAt: null,
                  enrollments: { some: { userId: 'u1', removedAt: null } },
                },
              },
            },
          },
        ],
      })
      expect(arg.orderBy).toEqual([{ isPinned: 'desc' }, { publishedAt: 'desc' }])
      expect(arg.take).toBeUndefined()
    })

    it('passes take through', async () => {
      await getStudentAnnouncements('u1', { take: 4 })
      expect(vi.mocked(db.announcement.findMany).mock.calls[0][0]!.take).toBe(4)
    })
  })

  describe('getAdminAnnouncements', () => {
    it('lists pinned first, then most recently edited, with sorted course titles', async () => {
      vi.mocked(db.announcement.findMany).mockResolvedValue([
        {
          id: 'a1',
          title: 'T',
          audience: 'COURSES',
          isPublished: true,
          isPinned: false,
          publishedAt: null,
          courses: [{ course: { title: 'Marhala 2' } }, { course: { title: 'Marhala 1' } }],
        },
      ] as never)

      const rows = await getAdminAnnouncements()

      const arg = vi.mocked(db.announcement.findMany).mock.calls[0][0]!
      expect(arg.where).toBeUndefined()
      expect(arg.orderBy).toEqual([{ isPinned: 'desc' }, { updatedAt: 'desc' }])
      expect(rows).toEqual([
        {
          id: 'a1',
          title: 'T',
          audience: 'COURSES',
          isPublished: true,
          isPinned: false,
          publishedAt: null,
          courseTitles: ['Marhala 1', 'Marhala 2'],
        },
      ])
    })
  })

  describe('getAnnouncementForEdit', () => {
    it('returns null when missing', async () => {
      vi.mocked(db.announcement.findUnique).mockResolvedValue(null as never)
      expect(await getAnnouncementForEdit('nope')).toBeNull()
    })

    it('flattens the attached course ids', async () => {
      vi.mocked(db.announcement.findUnique).mockResolvedValue({
        id: 'a1',
        title: 'T',
        content: 'C',
        imageUrl: null,
        audience: 'COURSES',
        isPublished: false,
        isPinned: true,
        publishedAt: null,
        courses: [{ courseId: 'c1' }, { courseId: 'c2' }],
      } as never)

      expect(await getAnnouncementForEdit('a1')).toMatchObject({ id: 'a1', courseIds: ['c1', 'c2'] })
    })
  })

  describe('getAnnouncementCourseOptions', () => {
    it('offers active courses plus archived ones already attached', async () => {
      vi.mocked(db.course.findMany).mockResolvedValue([
        { id: 'c1', title: 'Marhala 1', groupName: 'Marhala', level: 1, archivedAt: null },
        { id: 'c9', title: 'Old', groupName: null, level: null, archivedAt: new Date() },
      ] as never)

      const options = await getAnnouncementCourseOptions(['c9'])

      const arg = vi.mocked(db.course.findMany).mock.calls[0][0]!
      expect(arg.where).toEqual({ OR: [{ archivedAt: null }, { id: { in: ['c9'] } }] })
      expect(options).toEqual([
        { id: 'c1', title: 'Marhala 1', groupName: 'Marhala', level: 1, archived: false },
        { id: 'c9', title: 'Old', groupName: null, level: null, archived: true },
      ])
    })
  })
})
