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

export type StudentPurchaseRow = {
  id: string
  status: EnrollmentStatus
  paymentType: PaymentType
  amountPaid: number
  adminRemarks: string | null
  createdAt: Date
  courses: string[]
}

export async function getStudentPurchases(userId: string): Promise<StudentPurchaseRow[]> {
  const rows = await db.purchase.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      paymentType: true,
      amountPaid: true,
      adminRemarks: true,
      createdAt: true,
      items: { select: { course: { select: { title: true } } } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    paymentType: r.paymentType,
    amountPaid: r.amountPaid.toNumber(),
    adminRemarks: r.adminRemarks,
    createdAt: r.createdAt,
    courses: r.items.map((i) => i.course.title),
  }))
}
