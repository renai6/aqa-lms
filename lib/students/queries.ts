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

export async function getStudents({
  courseId,
  gender,
}: {
  courseId?: string
  gender?: Gender
} = {}): Promise<StudentRow[]> {
  const users = await db.user.findMany({
    where: {
      role: UserRole.STUDENT,
      ...(gender ? { gender } : {}),
      ...(courseId ? { enrollments: { some: { courseId } } } : {}),
    },
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
    take: 200,
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
  }))
}
