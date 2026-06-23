import { db } from '@/lib/db'
import { EnrollmentStatus, Gender, PaymentStatus, PaymentType, StudentType } from '@prisma/client'

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
  gender: Gender
  address: string
  contactNumber: string
  facebookName: string
  facebookLink: string
  studentType: StudentType
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
      gender: true,
      address: true,
      contactNumber: true,
      facebookName: true,
      facebookLink: true,
      studentType: true,
    },
  })
  if (!row) return null
  return {
    ...row,
    amountPaid: row.amountPaid.toNumber(),
  }
}

export type PaymentProofRow = {
  id: string
  proofUrl: string
  amount: number
  note: string | null
  submittedAt: Date
}

export type StudentEnrollmentDetail = {
  id: string
  courseId: string
  course: { title: string; tuitionFee: number | null }
  paymentStatus: PaymentStatus
  totalPaid: number
  enrolledAt: Date
  paymentProofs: PaymentProofRow[]
}

export type AdminEnrollmentPaymentDetail = {
  enrollmentId: string
  paymentStatus: PaymentStatus
  totalPaid: number
  course: { tuitionFee: number | null }
  paymentProofs: PaymentProofRow[]
}

export async function getStudentEnrollment(userId: string): Promise<StudentEnrollmentDetail | null> {
  const raw = await db.enrollment.findFirst({
    where: { userId },
    select: {
      id: true,
      courseId: true,
      course: { select: { title: true, tuitionFee: true } },
      paymentStatus: true,
      totalPaid: true,
      enrolledAt: true,
      paymentProofs: {
        orderBy: { submittedAt: 'desc' },
        select: { id: true, proofUrl: true, amount: true, note: true, submittedAt: true },
      },
    },
  })
  if (!raw) return null
  return {
    ...raw,
    course: {
      title: raw.course.title,
      tuitionFee: raw.course.tuitionFee?.toNumber() ?? null,
    },
    totalPaid: raw.totalPaid.toNumber(),
    paymentProofs: raw.paymentProofs.map(p => ({ ...p, amount: p.amount.toNumber() })),
  }
}

export async function getEnrollmentPaymentByRequest(
  userId: string,
  courseId: string,
): Promise<AdminEnrollmentPaymentDetail | null> {
  const raw = await db.enrollment.findFirst({
    where: { userId, courseId },
    select: {
      id: true,
      paymentStatus: true,
      totalPaid: true,
      course: { select: { tuitionFee: true } },
      paymentProofs: {
        orderBy: { submittedAt: 'desc' },
        select: { id: true, proofUrl: true, amount: true, note: true, submittedAt: true },
      },
    },
  })
  if (!raw) return null
  return {
    enrollmentId: raw.id,
    paymentStatus: raw.paymentStatus,
    totalPaid: raw.totalPaid.toNumber(),
    course: { tuitionFee: raw.course.tuitionFee?.toNumber() ?? null },
    paymentProofs: raw.paymentProofs.map(p => ({ ...p, amount: p.amount.toNumber() })),
  }
}
