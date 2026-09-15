import type { AnnouncementAudience, Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ACTIVE_COURSE } from '@/lib/courses/archive'
import { ACTIVE_ENROLLMENT } from '@/lib/enrollments/active'

// ─── Student ─────────────────────────────────────────────────────────────────

export type StudentAnnouncement = {
  id: string
  title: string
  content: string
  imageUrl: string | null
  isPinned: boolean
  publishedAt: Date | null
}

// A pending purchase has no enrollment yet, so that student sees only
// announcements for everyone. A removed enrollment or an archived course stops
// a course announcement reaching the student.
function studentAnnouncementWhere(userId: string): Prisma.AnnouncementWhereInput {
  return {
    isPublished: true,
    OR: [
      { audience: 'EVERYONE' },
      {
        courses: {
          some: {
            course: {
              ...ACTIVE_COURSE,
              enrollments: { some: { userId, ...ACTIVE_ENROLLMENT } },
            },
          },
        },
      },
    ],
  }
}

export async function getStudentAnnouncements(
  userId: string,
  options: { take?: number } = {},
): Promise<StudentAnnouncement[]> {
  return db.announcement.findMany({
    where: studentAnnouncementWhere(userId),
    orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
    take: options.take,
    select: { id: true, title: true, content: true, imageUrl: true, isPinned: true, publishedAt: true },
  })
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export type AdminAnnouncementRow = {
  id: string
  title: string
  audience: AnnouncementAudience
  courseTitles: string[]
  isPublished: boolean
  isPinned: boolean
  publishedAt: Date | null
}

export async function getAdminAnnouncements(): Promise<AdminAnnouncementRow[]> {
  const rows = await db.announcement.findMany({
    orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      audience: true,
      isPublished: true,
      isPinned: true,
      publishedAt: true,
      courses: { select: { course: { select: { title: true } } } },
    },
  })
  return rows.map(({ courses, ...row }) => ({
    ...row,
    courseTitles: courses.map((c) => c.course.title).sort((a, b) => a.localeCompare(b)),
  }))
}

export type AnnouncementForEdit = {
  id: string
  title: string
  content: string
  imageUrl: string | null
  audience: AnnouncementAudience
  isPublished: boolean
  isPinned: boolean
  publishedAt: Date | null
  courseIds: string[]
}

export async function getAnnouncementForEdit(id: string): Promise<AnnouncementForEdit | null> {
  const row = await db.announcement.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      content: true,
      imageUrl: true,
      audience: true,
      isPublished: true,
      isPinned: true,
      publishedAt: true,
      courses: { select: { courseId: true } },
    },
  })
  if (!row) return null
  const { courses, ...rest } = row
  return { ...rest, courseIds: courses.map((c) => c.courseId) }
}

export type AnnouncementCourseOption = {
  id: string
  title: string
  groupName: string | null
  level: number | null
  archived: boolean
}

// Archived courses are not offered, except ones this announcement already
// targets, so the admin can see them and untick them.
export async function getAnnouncementCourseOptions(
  attachedCourseIds: string[] = [],
): Promise<AnnouncementCourseOption[]> {
  const courses = await db.course.findMany({
    where: { OR: [{ ...ACTIVE_COURSE }, { id: { in: attachedCourseIds } }] },
    orderBy: { title: 'asc' },
    select: { id: true, title: true, groupName: true, level: true, archivedAt: true },
  })
  return courses.map(({ archivedAt, ...course }) => ({ ...course, archived: archivedAt !== null }))
}
