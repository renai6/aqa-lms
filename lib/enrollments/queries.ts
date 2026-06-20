import { db } from '@/lib/db'
import { EnrollmentStatus } from '@prisma/client'

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
