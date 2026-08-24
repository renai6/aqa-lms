import { db } from "@/lib/db";
import type { EnrollmentStatus, PaymentStatus } from "@prisma/client";
import { computeBalance, type Balance } from "@/lib/payments/balance";

export type PaymentEnrollment = {
  id: string;
  paymentStatus: PaymentStatus;
  course: { title: string; archivedAt: Date | null };
  // Only `status` is selected: the guard asks whether one is PENDING, and
  // nothing on this page needs the rest. The dashboard's richer per-enrollment
  // state comes from getEnrollmentPaymentStates below.
  payments: { status: EnrollmentStatus }[];
};

// Scoped by userId, so another student's enrollment simply comes back null and
// the guard reports it as not found.
export async function getEnrollmentForPayment(
  userId: string,
  enrollmentId: string,
): Promise<PaymentEnrollment | null> {
  return db.enrollment.findFirst({
    where: { id: enrollmentId, userId },
    select: {
      id: true,
      paymentStatus: true,
      course: { select: { title: true, archivedAt: true } },
      payments: { select: { status: true } },
    },
  });
}

export type EnrollmentPaymentState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "rejected"; reason: string | null };

// The dashboard's Payment section renders one of three states per enrollment,
// decided by that enrollment's most recent payment.
export async function getEnrollmentPaymentStates(
  userId: string,
): Promise<Record<string, EnrollmentPaymentState>> {
  const rows = await db.payment.findMany({
    where: { enrollment: { userId } },
    orderBy: { createdAt: "desc" },
    select: { enrollmentId: true, status: true, adminRemarks: true },
  });

  const states: Record<string, EnrollmentPaymentState> = {};
  for (const row of rows) {
    // Rows are newest first, so the first one seen for an enrollment wins.
    if (states[row.enrollmentId]) continue;
    if (row.status === "PENDING") {
      states[row.enrollmentId] = { kind: "pending" };
    } else if (row.status === "REJECTED") {
      states[row.enrollmentId] = { kind: "rejected", reason: row.adminRemarks };
    } else {
      states[row.enrollmentId] = { kind: "idle" };
    }
  }
  return states;
}

export type AdminPaymentRow = {
  id: string;
  status: EnrollmentStatus;
  amount: number;
  createdAt: Date;
  studentName: string;
  studentEmail: string;
  courseTitle: string;
  balance: Balance;
};

export async function getAdminPaymentsByStatus(
  status: EnrollmentStatus,
): Promise<AdminPaymentRow[]> {
  const rows = await db.payment.findMany({
    where: { status, source: "SUBMITTED" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      amount: true,
      createdAt: true,
      enrollment: {
        select: {
          totalDue: true,
          // Approved rows only: pending and rejected payments are not money
          // received and must not move the balance.
          payments: {
            where: { status: "APPROVED" },
            select: { amount: true },
          },
          user: { select: { firstName: true, lastName: true, email: true } },
          course: { select: { title: true } },
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    amount: r.amount.toNumber(),
    createdAt: r.createdAt,
    studentName: `${r.enrollment.user.firstName} ${r.enrollment.user.lastName}`,
    studentEmail: r.enrollment.user.email,
    courseTitle: r.enrollment.course.title,
    balance: computeBalance(
      r.enrollment.totalDue?.toNumber() ?? null,
      r.enrollment.payments.map((p) => p.amount.toNumber()),
    ),
  }));
}

export async function getPaymentStatusCounts(): Promise<
  Record<string, number>
> {
  const grouped = await db.payment.groupBy({
    by: ["status"],
    where: { source: "SUBMITTED" },
    _count: { _all: true },
  });
  return Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
}

export type AdminPaymentDetail = {
  id: string;
  status: EnrollmentStatus;
  amount: number;
  adminRemarks: string | null;
  createdAt: Date;
  enrollmentPaymentStatus: PaymentStatus;
  student: {
    firstName: string;
    lastName: string;
    email: string;
    contactNumber: string | null;
  };
  courseTitle: string;
  // The enrollment's balance as it stands now. This payment is PENDING, so it
  // is not in the approved sum and is not counted here.
  balance: Balance;
  // What that balance becomes if this payment is approved.
  balanceIfApproved: Balance;
};

export async function getAdminPaymentById(
  id: string,
): Promise<AdminPaymentDetail | null> {
  const r = await db.payment.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      amount: true,
      adminRemarks: true,
      createdAt: true,
      enrollment: {
        select: {
          paymentStatus: true,
          totalDue: true,
          payments: {
            where: { status: "APPROVED" },
            select: { amount: true },
          },
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              contactNumber: true,
            },
          },
          course: { select: { title: true } },
        },
      },
    },
  });
  if (!r) return null;
  const totalDue = r.enrollment.totalDue?.toNumber() ?? null;
  const approvedAmounts = r.enrollment.payments.map((p) => p.amount.toNumber());
  const amount = r.amount.toNumber();
  return {
    id: r.id,
    status: r.status,
    amount,
    adminRemarks: r.adminRemarks,
    createdAt: r.createdAt,
    enrollmentPaymentStatus: r.enrollment.paymentStatus,
    student: r.enrollment.user,
    courseTitle: r.enrollment.course.title,
    balance: computeBalance(totalDue, approvedAmounts),
    balanceIfApproved: computeBalance(totalDue, [...approvedAmounts, amount]),
  };
}
