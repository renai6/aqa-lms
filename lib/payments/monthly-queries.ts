// The database reads behind the admin monthly tracker. Kept out of
// ./queries.ts, which is already long enough that adding matrix assembly to
// it would make it unreadable in one sitting.

import { db } from "@/lib/db";
import { contactOf, GUARDIAN_CONTACT_SELECT } from "@/lib/students/contact";
import {
  buildMonthlyMatrix,
  type MatrixEnrollment,
  type MonthlyMatrix,
} from "@/lib/payments/monthly";
import { dateToMonthKey } from "@/lib/time/manila";
import { ACTIVE_COURSE } from "@/lib/courses/archive";
import { isMovedAway } from "@/lib/enrollments/moved";

export type MonthlyCourse = {
  id: string;
  title: string;
  tuitionFee: number | null;
};

// Deliberately not filtered on `isPublished`: an unpublished course can still
// have enrolled students who owe money, and hiding it would hide their
// arrears.
export async function getMonthlyCourses(): Promise<MonthlyCourse[]> {
  const rows = await db.course.findMany({
    where: { paymentFrequency: "MONTHLY", ...ACTIVE_COURSE },
    orderBy: [{ groupName: "asc" }, { level: "asc" }, { title: "asc" }],
    select: { id: true, title: true, tuitionFee: true },
  });
  return rows.map((c) => ({
    id: c.id,
    title: c.title,
    tuitionFee: c.tuitionFee?.toNumber() ?? null,
  }));
}

export async function getCourseMonthlyMatrix(
  courseId: string,
  now: Date = new Date(),
): Promise<{ course: MonthlyCourse; matrix: MonthlyMatrix } | null> {
  const course = await db.course.findFirst({
    where: { id: courseId, paymentFrequency: "MONTHLY", ...ACTIVE_COURSE },
    select: { id: true, title: true, tuitionFee: true },
  });
  if (!course) return null;

  const rows = await db.enrollment.findMany({
    // No ACTIVE_ENROLLMENT here. Staff surfaces deliberately keep removed
    // rows so the history stays auditable, and a removed student's unpaid
    // months are exactly what an admin needs to see.
    where: { courseId },
    select: {
      id: true,
      enrolledAt: true,
      completedAt: true,
      removedAt: true,
      removedReason: true,
      user: {
        select: { firstName: true, lastName: true, email: true, guardian: GUARDIAN_CONTACT_SELECT },
      },
      payments: {
        // Rejected payments are neither money received nor awaiting review,
        // so they say nothing about a month.
        where: { status: { in: ["APPROVED", "PENDING"] } },
        select: { id: true, amount: true, periodMonth: true, status: true },
      },
    },
  });

  // The exception is a row moved to another course: its money now lives on
  // the destination enrollment, so here it would only show every month unpaid.
  const enrollments: MatrixEnrollment[] = rows
    .filter((r) => !(r.removedAt && isMovedAway(r.removedReason)))
    .map((r) => ({
      id: r.id,
      enrolledAt: r.enrolledAt,
      completedAt: r.completedAt,
      removedAt: r.removedAt,
      student: {
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        ...(({ email, parentName }) => ({ email, parentName }))(contactOf(r.user)),
      },
      payments: r.payments.map((p) => ({
        id: p.id,
        amount: p.amount.toNumber(),
        periodMonth: p.periodMonth ? dateToMonthKey(p.periodMonth) : null,
        status: p.status,
      })),
    }));

  const tuitionFee = course.tuitionFee?.toNumber() ?? null;
  return {
    course: { id: course.id, title: course.title, tuitionFee },
    matrix: buildMonthlyMatrix(enrollments, tuitionFee, now),
  };
}
