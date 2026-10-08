// lib/students/queries.ts
import {
  type CourseType,
  type EnrollmentStatus,
  Gender,
  type PaymentFrequency,
  PaymentStatus,
  type StudentType,
  UserRole,
} from '@prisma/client'
import { db } from '@/lib/db'
import type { KidListItem } from '@/lib/students/dependents'
import { contactOf, GUARDIAN_CONTACT_SELECT } from '@/lib/students/contact'

export type StudentRow = {
  id: string
  firstName: string
  lastName: string
  email: string
  parentName: string | null
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
    courseType: CourseType
    enrolledAt: Date
    removedAt: Date | null
  }[]
}

// What the CSV export reads: a StudentRow whose enrollments carry the payments
// behind the Amount Paid and Last Payment Date columns. Separate from
// StudentRow because the paginated admin table renders neither, and should not
// pay for an extra join per enrollment to fetch them.
export type StudentExportRow = Omit<StudentRow, 'enrollments'> & {
  enrollments: (StudentRow['enrollments'][number] & {
    payments: { amount: number; status: EnrollmentStatus; createdAt: Date }[]
  })[]
}

export type StudentDetail = {
  id: string
  firstName: string
  lastName: string
  email: string
  parentName: string | null
  gender: Gender | null
  isActive: boolean
  createdAt: Date
  contactNumber: string | null
  address: string | null
  facebookName: string | null
  facebookLink: string | null
  studentType: StudentType | null
  // Set on a kid: the parent account that manages it.
  guardian: { id: string; firstName: string; lastName: string } | null
  // Set on a parent: the kid profiles they manage.
  dependents: KidListItem[]
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
    totalDue: number | null
    hasCertificate: boolean
    paymentFrequency: PaymentFrequency | null
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
      guardian: GUARDIAN_CONTACT_SELECT,
      enrollments: {
        select: {
          id: true,
          courseId: true,
          enrolledAt: true,
          removedAt: true,
          course: { select: { title: true, courseType: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    ...range,
  })

  return users.map(({ guardian, ...u }) => {
    const contact = contactOf({ ...u, guardian })
    return {
      ...u,
      email: contact.email,
      contactNumber: contact.contactNumber,
      parentName: contact.parentName,
      enrollments: u.enrollments.map((e) => ({
        id: e.id,
        courseId: e.courseId,
        courseTitle: e.course.title,
        courseType: e.course.courseType,
        enrolledAt: e.enrolledAt,
        removedAt: e.removedAt,
      })),
    }
  })
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
): Promise<StudentExportRow[]> {
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
      guardian: GUARDIAN_CONTACT_SELECT,
      enrollments: {
        select: {
          id: true,
          courseId: true,
          enrolledAt: true,
          removedAt: true,
          course: { select: { title: true, courseType: true } },
          // Every status, not just APPROVED: `formatAmountsPaid` owns the rule
          // that only approved money counts, so the filter lives in one place
          // that is provable without a database.
          payments: { select: { amount: true, status: true, createdAt: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return users.map(({ guardian, ...u }) => {
    const contact = contactOf({ ...u, guardian })
    return {
      ...u,
      email: contact.email,
      contactNumber: contact.contactNumber,
      parentName: contact.parentName,
      enrollments: u.enrollments.map((e) => ({
        id: e.id,
        courseId: e.courseId,
        courseTitle: e.course.title,
        courseType: e.course.courseType,
        enrolledAt: e.enrolledAt,
        removedAt: e.removedAt,
        payments: e.payments.map((p) => ({
          // Decimal off the wire; the formatters do centavo arithmetic on numbers.
          amount: p.amount.toNumber(),
          status: p.status,
          createdAt: p.createdAt,
        })),
      })),
    }
  })
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
      contactNumber: true,
      address: true,
      facebookName: true,
      facebookLink: true,
      studentType: true,
      guardian: { select: { ...GUARDIAN_CONTACT_SELECT.select, id: true } },
      dependents: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          gender: true,
          isActive: true,
          _count: { select: { purchases: true, enrollments: true } },
        },
      },
      certificates: { select: { courseId: true } },
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
          totalDue: true,
          course: { select: { title: true, paymentFrequency: true } },
        },
        orderBy: { enrolledAt: 'desc' },
      },
    },
  })

  if (!user || user.role !== UserRole.STUDENT) return null

  const contact = contactOf(user)
  const certified = new Set(user.certificates.map((c) => c.courseId))

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: contact.email,
    parentName: contact.parentName,
    gender: user.gender,
    isActive: user.isActive,
    createdAt: user.createdAt,
    contactNumber: contact.contactNumber,
    address: user.address,
    facebookName: user.facebookName,
    facebookLink: user.facebookLink,
    studentType: user.studentType,
    guardian: user.guardian
      ? { id: user.guardian.id, firstName: user.guardian.firstName, lastName: user.guardian.lastName }
      : null,
    dependents: user.dependents.map(({ _count, ...k }) => ({
      ...k,
      hasHistory: _count.purchases + _count.enrollments > 0,
    })),
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
      totalDue: e.totalDue?.toNumber() ?? null,
      hasCertificate: certified.has(e.courseId),
      paymentFrequency: e.course.paymentFrequency,
    })),
  }
}

export type RosterRow = {
  enrollmentId: string
  studentId: string
  firstName: string
  lastName: string
  email: string
  parentName: string | null
  enrolledAt: Date
  paymentStatus: PaymentStatus
  removedAt: Date | null
  removedReason: string | null
  // Null when this enrollment's balance is not tracked.
  totalDue: number | null
  hasCertificate: boolean
  // Courses the student is actively enrolled in, so the course move picker
  // can leave them out.
  activeCourseIds: string[]
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
      totalDue: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          guardian: GUARDIAN_CONTACT_SELECT,
          certificates: { where: { courseId }, select: { id: true } },
          enrollments: { where: { removedAt: null }, select: { courseId: true } },
        },
      },
      batch: { select: { id: true, name: true, number: true } },
    },
  })

  return enrollments.map((e) => ({
    enrollmentId: e.id,
    studentId: e.user.id,
    firstName: e.user.firstName,
    lastName: e.user.lastName,
    ...(({ email, parentName }) => ({ email, parentName }))(contactOf(e.user)),
    enrolledAt: e.enrolledAt,
    paymentStatus: e.paymentStatus,
    removedAt: e.removedAt,
    removedReason: e.removedReason,
    totalDue: e.totalDue?.toNumber() ?? null,
    hasCertificate: e.user.certificates.length > 0,
    activeCourseIds: e.user.enrollments.map((x) => x.courseId),
    batch: e.batch,
  }))
}
