import { db } from '@/lib/db'
import { EnrollmentStatus } from '@prisma/client'

export type PublishedCourseRow = {
  id: string
  title: string
  description: string | null
}

export async function getPublishedCourses(): Promise<PublishedCourseRow[]> {
  return db.course.findMany({
    where: { isPublished: true },
    orderBy: { title: 'asc' },
    select: { id: true, title: true, description: true },
  })
}

export async function getPublishedCourseById(id: string): Promise<PublishedCourseRow | null> {
  return db.course.findFirst({
    where: { id, isPublished: true },
    select: { id: true, title: true, description: true },
  })
}

export type EnrollmentRequestRow = {
  id: string
  firstName: string
  lastName: string
  email: string
  status: EnrollmentStatus
  createdAt: Date
  course: { title: string }
}

export type EnrollmentRequestDetail = EnrollmentRequestRow & {
  courseId: string
  paymentProofUrl: string | null
  adminRemarks: string | null
  userId: string | null
  updatedAt: Date
}

export async function getEnrollmentRequestsByStatus(
  status: EnrollmentStatus
): Promise<EnrollmentRequestRow[]> {
  return db.enrollmentRequest.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      createdAt: true,
      course: {
        select: {
          title: true,
        },
      },
    },
  })
}

export async function getEnrollmentRequestById(
  id: string
): Promise<EnrollmentRequestDetail | null> {
  return db.enrollmentRequest.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      createdAt: true,
      courseId: true,
      course: {
        select: {
          title: true,
        },
      },
      paymentProofUrl: true,
      adminRemarks: true,
      userId: true,
      updatedAt: true,
    },
  })
}
