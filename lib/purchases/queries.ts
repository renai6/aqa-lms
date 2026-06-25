import { db } from '@/lib/db'
import type { EnrollmentStatus, PaymentType } from '@prisma/client'

export type PurchasableCourse = {
  id: string
  title: string
  description: string | null
  imageUrl: string | null
  tuitionFee: number | null
}

// Published courses the student is not already enrolled in and has no PENDING/APPROVED purchase for.
export async function getPurchasableCourses(userId: string): Promise<PurchasableCourse[]> {
  const [courses, enrollments, pendingItems] = await Promise.all([
    db.course.findMany({
      where: { isPublished: true },
      orderBy: { title: 'asc' },
      select: { id: true, title: true, description: true, imageUrl: true, tuitionFee: true },
    }),
    db.enrollment.findMany({ where: { userId }, select: { courseId: true } }),
    db.purchaseItem.findMany({
      where: { purchase: { userId, status: { in: ['PENDING', 'APPROVED'] } } },
      select: { courseId: true },
    }),
  ])
  const taken = new Set([...enrollments.map((e) => e.courseId), ...pendingItems.map((p) => p.courseId)])
  return courses
    .filter((c) => !taken.has(c.id))
    .map((c) => ({ ...c, tuitionFee: c.tuitionFee?.toNumber() ?? null }))
}

export type CheckoutCourse = { id: string; title: string; tuitionFee: number | null }

// Validates the selected course ids are purchasable; returns the resolved course rows.
export async function getCheckoutCourses(userId: string, courseIds: string[]): Promise<CheckoutCourse[]> {
  const available = await getPurchasableCourses(userId)
  const byId = new Map(available.map((c) => [c.id, c]))
  const resolved: CheckoutCourse[] = []
  for (const id of courseIds) {
    const c = byId.get(id)
    if (c) resolved.push({ id: c.id, title: c.title, tuitionFee: c.tuitionFee })
  }
  return resolved
}

export type AdminPurchaseRow = {
  id: string
  status: EnrollmentStatus
  amountPaid: number
  createdAt: Date
  studentName: string
  studentEmail: string
  courseCount: number
}

export async function getAdminPurchasesByStatus(status: EnrollmentStatus): Promise<AdminPurchaseRow[]> {
  const rows = await db.purchase.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      status: true,
      amountPaid: true,
      createdAt: true,
      user: { select: { firstName: true, lastName: true, email: true } },
      _count: { select: { items: true } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    amountPaid: r.amountPaid.toNumber(),
    createdAt: r.createdAt,
    studentName: `${r.user.firstName} ${r.user.lastName}`,
    studentEmail: r.user.email,
    courseCount: r._count.items,
  }))
}

export type AdminPurchaseDetail = {
  id: string
  status: EnrollmentStatus
  paymentType: PaymentType
  amountPaid: number
  paymentProofUrl: string
  adminRemarks: string | null
  createdAt: Date
  student: { firstName: string; lastName: string; email: string; contactNumber: string | null }
  courses: { id: string; title: string; tuitionFee: number | null }[]
}

export async function getAdminPurchaseById(id: string): Promise<AdminPurchaseDetail | null> {
  const r = await db.purchase.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      paymentType: true,
      amountPaid: true,
      paymentProofUrl: true,
      adminRemarks: true,
      createdAt: true,
      user: { select: { firstName: true, lastName: true, email: true, contactNumber: true } },
      items: { select: { course: { select: { id: true, title: true, tuitionFee: true } } } },
    },
  })
  if (!r) return null
  return {
    id: r.id,
    status: r.status,
    paymentType: r.paymentType,
    amountPaid: r.amountPaid.toNumber(),
    paymentProofUrl: r.paymentProofUrl,
    adminRemarks: r.adminRemarks,
    createdAt: r.createdAt,
    student: r.user,
    courses: r.items.map((i) => ({
      id: i.course.id,
      title: i.course.title,
      tuitionFee: i.course.tuitionFee?.toNumber() ?? null,
    })),
  }
}

export async function getPurchaseStatusCounts(): Promise<Record<string, number>> {
  const grouped = await db.purchase.groupBy({ by: ['status'], _count: { _all: true } })
  return Object.fromEntries(grouped.map((g) => [g.status, g._count._all]))
}
