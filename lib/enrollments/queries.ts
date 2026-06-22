import { db } from '@/lib/db'
import { EnrollmentStatus, PaymentType } from '@prisma/client'

export type PublishedCourseRow = {
  id: string
  title: string
  description: string | null
  imageUrl: string | null
  tuitionFee: number | null
}

export async function getPublishedCourses(): Promise<PublishedCourseRow[]> {
  const rows = await db.course.findMany({
    where: { isPublished: true },
    orderBy: { title: 'asc' },
    select: { id: true, title: true, description: true, imageUrl: true, tuitionFee: true },
  })
  return rows.map(r => ({ ...r, tuitionFee: r.tuitionFee?.toNumber() ?? null }))
}

export async function getPublishedCourseById(id: string): Promise<PublishedCourseRow | null> {
  const course = await db.course.findUnique({
    where: { id },
    select: { id: true, title: true, description: true, imageUrl: true, isPublished: true, tuitionFee: true },
  })
  if (!course?.isPublished) return null
  return { id: course.id, title: course.title, description: course.description, imageUrl: course.imageUrl, tuitionFee: course.tuitionFee?.toNumber() ?? null }
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
  paymentType: PaymentType
  amountPaid: number
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
  const row = await db.enrollmentRequest.findUnique({
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
      paymentType: true,
      amountPaid: true,
    },
  })
  if (!row) return null
  return {
    ...row,
    amountPaid: row.amountPaid.toNumber(),
  }
}
