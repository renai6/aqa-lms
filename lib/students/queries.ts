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
  enrollments: {
    courseId: string
    courseTitle: string
    enrolledAt: Date
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
    courseId: string
    courseTitle: string
    enrolledAt: Date
    completedAt: Date | null
    progress: number
    paymentStatus: PaymentStatus
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
      enrollments: {
        select: {
          courseId: true,
          enrolledAt: true,
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
      courseId: e.courseId,
      courseTitle: e.course.title,
      enrolledAt: e.enrolledAt,
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
        select: {
          courseId: true,
          enrolledAt: true,
          completedAt: true,
          progress: true,
          paymentStatus: true,
          course: { select: { title: true } },
        },
      },
    },
  })

  if (!user || user.role !== UserRole.STUDENT) return null

  const { role: _role, ...userWithoutRole } = user
  return {
    ...userWithoutRole,
    enrollments: user.enrollments.map((e) => ({
      courseId: e.courseId,
      courseTitle: e.course.title,
      enrolledAt: e.enrolledAt,
      completedAt: e.completedAt,
      progress: e.progress,
      paymentStatus: e.paymentStatus,
    })),
  }
}
