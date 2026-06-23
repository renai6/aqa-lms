// lib/students/queries.ts
import { Gender, PaymentStatus } from '@prisma/client'
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
      role: 'STUDENT',
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
  const user = await db.user.findFirst({
    where: { id, role: 'STUDENT' },
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
          completedAt: true,
          progress: true,
          paymentStatus: true,
          course: { select: { title: true } },
        },
      },
    },
  })

  if (!user) return null

  return {
    ...user,
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
