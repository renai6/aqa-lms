// lib/students/queries.ts
import { Gender, PaymentStatus, UserRole } from '@prisma/client'
import { db } from '@/lib/db'

export type StudentRow = {
  id: string
  firstName: string
  lastName: string
  email: string
  gender: Gender | null
  isActive: boolean
  createdAt: Date
  contactNumber: string | null
  facebookName: string | null
  facebookLink: string | null
  enrollments: {
    id: string
    courseId: string
    courseTitle: string
    enrolledAt: Date
    removedAt: Date | null
  }[]
}

export type StudentDetail = {
  id: string
  firstName: string
  lastName: string
  email: string
  gender: Gender | null
  isActive: boolean
  createdAt: Date
  enrollments: {
    id: string
    courseId: string
    courseTitle: string
    enrolledAt: Date
    completedAt: Date | null
    progress: number
    paymentStatus: PaymentStatus
    removedAt: Date | null
    removedReason: string | null
  }[]
}

export const STUDENTS_PAGE_SIZE = 50

export type StudentFilters = {
  courseId?: string
  gender?: Gender
}

export type StudentsPage = {
  students: StudentRow[]
  total: number
  // The page actually returned, which may differ from the one requested.
  page: number
  pageCount: number
}

function whereFor({ courseId, gender }: StudentFilters) {
  return {
    role: UserRole.STUDENT,
    ...(gender ? { gender } : {}),
    ...(courseId ? { enrollments: { some: { courseId } } } : {}),
  }
}

// `range` omitted means every matching student; the spread leaves skip/take off
// the query entirely rather than sending an undefined limit.
async function findStudents(
  filters: StudentFilters,
  range?: { skip: number; take: number },
): Promise<StudentRow[]> {
  const users = await db.user.findMany({
    where: whereFor(filters),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      gender: true,
      isActive: true,
      createdAt: true,
      contactNumber: true,
      facebookName: true,
      facebookLink: true,
      enrollments: {
        select: {
          id: true,
          courseId: true,
          enrolledAt: true,
          removedAt: true,
          course: { select: { title: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    ...range,
  })

  return users.map((u) => ({
    ...u,
    enrollments: u.enrollments.map((e) => ({
      id: e.id,
      courseId: e.courseId,
      courseTitle: e.course.title,
      enrolledAt: e.enrolledAt,
      removedAt: e.removedAt,
    })),
  }))
}

// One page of the admin students table. The count is awaited first so that an
// out-of-range `?page=` clamps to a page that exists instead of rendering an
// empty table for a filter that does match students.
export async function getStudentsPage(
  filters: StudentFilters,
  page: number,
): Promise<StudentsPage> {
  const total = await db.user.count({ where: whereFor(filters) })
  const pageCount = Math.max(1, Math.ceil(total / STUDENTS_PAGE_SIZE))
  const safePage = Math.min(Math.max(Math.trunc(page) || 1, 1), pageCount)

  const students = await findStudents(filters, {
    skip: (safePage - 1) * STUDENTS_PAGE_SIZE,
    take: STUDENTS_PAGE_SIZE,
  })

  return { students, total, page: safePage, pageCount }
}

// Deliberately unpaginated, for the CSV export: a capped export hands the admin
// a partial roster that looks complete.
export async function getAllStudents(
  filters: StudentFilters,
): Promise<StudentRow[]> {
  return findStudents(filters)
}

export async function getStudentById(id: string): Promise<StudentDetail | null> {
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      gender: true,
      isActive: true,
      createdAt: true,
      role: true,
      enrollments: {
        // Removed enrollments stay visible to admins, badged and restorable,
        // so the history of a correction is never hidden from staff.
        select: {
          id: true,
          courseId: true,
          enrolledAt: true,
          completedAt: true,
          progress: true,
          paymentStatus: true,
          removedAt: true,
          removedReason: true,
          course: { select: { title: true } },
        },
        orderBy: { enrolledAt: 'desc' },
      },
    },
  })

  if (!user || user.role !== UserRole.STUDENT) return null

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    gender: user.gender,
    isActive: user.isActive,
    createdAt: user.createdAt,
    enrollments: user.enrollments.map((e) => ({
      id: e.id,
      courseId: e.courseId,
      courseTitle: e.course.title,
      enrolledAt: e.enrolledAt,
      completedAt: e.completedAt,
      progress: e.progress,
      paymentStatus: e.paymentStatus,
      removedAt: e.removedAt,
      removedReason: e.removedReason,
    })),
  }
}

export type RosterRow = {
  enrollmentId: string
  studentId: string
  firstName: string
  lastName: string
  email: string
  enrolledAt: Date
  paymentStatus: PaymentStatus
  removedAt: Date | null
  removedReason: string | null
  // Null for enrollments written before ensureActiveBatchId existed; those
  // students see no lesson content until an admin moves them into a batch.
  batch: { id: string; name: string | null; number: number } | null
}

// Every student ever enrolled in the course, removed ones included: this is the
// admin's roster, and hiding a removal would hide the correction that caused it.
// Removed rows sort to the bottom so the active class reads first.
export async function getCourseRoster(courseId: string): Promise<RosterRow[]> {
  const enrollments = await db.enrollment.findMany({
    where: { courseId },
    orderBy: [
      { removedAt: { sort: 'asc', nulls: 'first' } },
      { user: { lastName: 'asc' } },
    ],
    select: {
      id: true,
      enrolledAt: true,
      removedAt: true,
      removedReason: true,
      paymentStatus: true,
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      batch: { select: { id: true, name: true, number: true } },
    },
  })

  return enrollments.map((e) => ({
    enrollmentId: e.id,
    studentId: e.user.id,
    firstName: e.user.firstName,
    lastName: e.user.lastName,
    email: e.user.email,
    enrolledAt: e.enrolledAt,
    paymentStatus: e.paymentStatus,
    removedAt: e.removedAt,
    removedReason: e.removedReason,
    batch: e.batch,
  }))
}
