import { db } from "@/lib/db";
import type { EnrollmentStatus, PaymentFrequency, PaymentStatus } from "@prisma/client";
import { computeBalance, type Balance } from "@/lib/payments/balance";
import { allocate } from "@/lib/purchases/allocation";
import { ACTIVE_ENROLLMENT } from "@/lib/enrollments/active";
import { dateToMonthKey, monthKeyLabel, type MonthKey } from "@/lib/time/manila";
import { payableMonths } from "@/lib/payments/monthly";

export type PaymentEnrollment = {
  id: string;
  paymentStatus: PaymentStatus;
  course: {
    title: string;
    archivedAt: Date | null;
    paymentFrequency: PaymentFrequency | null;
    tuitionFee: number | null;
  };
  enrolledAt: Date;
  completedAt: Date | null;
  removedAt: Date | null;
  // `amount` is here for Task 5's month picker, which needs the approved
  // total per month to know which months are still outstanding.
  payments: {
    status: EnrollmentStatus;
    periodMonth: MonthKey | null;
    amount: number;
  }[];
  balance: Balance;
};

// Scoped by userId, so another student's enrollment simply comes back null and
// the guard reports it as not found.
export async function getEnrollmentForPayment(
  userId: string,
  enrollmentId: string,
): Promise<PaymentEnrollment | null> {
  const r = await db.enrollment.findFirst({
    where: { id: enrollmentId, userId, ...ACTIVE_ENROLLMENT },
    select: {
      id: true,
      paymentStatus: true,
      totalDue: true,
      enrolledAt: true,
      completedAt: true,
      removedAt: true,
      course: {
        select: {
          title: true,
          archivedAt: true,
          paymentFrequency: true,
          tuitionFee: true,
        },
      },
      payments: {
        select: { status: true, amount: true, periodMonth: true },
      },
    },
  });
  if (!r) return null;
  return {
    id: r.id,
    paymentStatus: r.paymentStatus,
    course: {
      title: r.course.title,
      archivedAt: r.course.archivedAt,
      paymentFrequency: r.course.paymentFrequency,
      tuitionFee: r.course.tuitionFee?.toNumber() ?? null,
    },
    enrolledAt: r.enrolledAt,
    completedAt: r.completedAt,
    removedAt: r.removedAt,
    payments: r.payments.map((p) => ({
      status: p.status,
      periodMonth: p.periodMonth ? dateToMonthKey(p.periodMonth) : null,
      amount: p.amount.toNumber(),
    })),
    balance: computeBalance(
      r.totalDue?.toNumber() ?? null,
      r.payments
        .filter((p) => p.status === "APPROVED")
        .map((p) => p.amount.toNumber()),
    ),
  };
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
    where: { enrollment: { userId, ...ACTIVE_ENROLLMENT } },
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

// One balance per enrollment for the dashboard's Payment section, keyed by
// enrollment id. Mirrors getEnrollmentPaymentStates, which the same section
// already calls.
export async function getEnrollmentBalances(
  userId: string,
): Promise<Record<string, Balance>> {
  const rows = await db.enrollment.findMany({
    where: { userId, ...ACTIVE_ENROLLMENT },
    select: {
      id: true,
      totalDue: true,
      payments: { where: { status: "APPROVED" }, select: { amount: true } },
    },
  });

  return Object.fromEntries(
    rows.map((r) => [
      r.id,
      computeBalance(
        r.totalDue?.toNumber() ?? null,
        r.payments.map((p) => p.amount.toNumber()),
      ),
    ]),
  );
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
  // The approve form projects the balance after approval itself, from these
  // two plus `amount` and whatever the admin types into the catch-up fields.
  // Computing it here instead reported "not tracked" in exactly the case the
  // admin is setting a total in, since `catchUpPrefill` is only offered when
  // the stored `totalDue` is null.
  totalDue: number | null;
  approvedPaid: number;
  // Non-null only when the enrollment has no total yet, in which case the
  // approve form offers to start tracking it. `alreadyPaid` is itself
  // nullable: null means "do not render this field", which is the case when
  // an APPROVED CHECKOUT payment already exists for the enrollment - that
  // money is already in the ledger, so prefilling and re-submitting it would
  // double-count it.
  catchUpPrefill: { totalDue: string; alreadyPaid: string | null } | null;
  // Monthly courses only. `periodMonth` is what the student picked, null for
  // a historical row predating the field; `monthOptions` is what the admin
  // may change it to.
  isMonthly: boolean;
  periodMonth: MonthKey | null;
  monthOptions: { key: MonthKey; label: string }[];
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
      periodMonth: true,
      enrollment: {
        select: {
          paymentStatus: true,
          totalDue: true,
          enrolledAt: true,
          completedAt: true,
          removedAt: true,
          payments: {
            where: { status: "APPROVED" },
            select: { amount: true, source: true },
          },
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              contactNumber: true,
            },
          },
          course: {
            select: {
              id: true,
              title: true,
              tuitionFee: true,
              paymentFrequency: true,
            },
          },
          purchase: {
            select: {
              amountPaid: true,
              items: {
                select: { course: { select: { id: true, tuitionFee: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!r) return null;
  const totalDue = r.enrollment.totalDue?.toNumber() ?? null;
  const approvedAmounts = r.enrollment.payments.map((p) => p.amount.toNumber());
  const amount = r.amount.toNumber();
  // An APPROVED CHECKOUT row means the enrollment's checkout money is
  // already in the ledger, whether or not `totalDue` happens to be null
  // (a MONTHLY/YEARLY course, or one an admin cleared, leaves the total
  // blank while still writing that row at purchase approval). Offering the
  // already-paid figure again in that case would write a second CHECKOUT
  // row for money already recorded.
  const hasCheckoutPayment = r.enrollment.payments.some(
    (p) => p.source === "CHECKOUT",
  );
  const catchUpPrefill =
    r.enrollment.totalDue === null
      ? {
          totalDue:
            r.enrollment.course.tuitionFee !== null &&
            r.enrollment.course.paymentFrequency !== "MONTHLY" &&
            r.enrollment.course.paymentFrequency !== "YEARLY"
              ? String(r.enrollment.course.tuitionFee.toNumber())
              : "",
          alreadyPaid: hasCheckoutPayment
            ? null
            : r.enrollment.purchase
              ? String(
                  allocate(
                    r.enrollment.purchase.amountPaid.toNumber(),
                    r.enrollment.purchase.items.map(
                      (i) => i.course.tuitionFee?.toNumber() ?? null,
                    ),
                  )[
                    r.enrollment.purchase.items.findIndex(
                      (i) => i.course.id === r.enrollment.course.id,
                    )
                  ] ?? 0,
                )
              : "",
        }
      : null;
  const isMonthly = r.enrollment.course.paymentFrequency === "MONTHLY";
  const monthOptions = isMonthly
    ? payableMonths(
        {
          enrolledAt: r.enrollment.enrolledAt,
          completedAt: r.enrollment.completedAt,
          removedAt: r.enrollment.removedAt,
        },
        new Date(),
      ).map((key) => ({ key, label: monthKeyLabel(key) }))
    : [];
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
    totalDue,
    approvedPaid:
      approvedAmounts.reduce((sum, a) => sum + Math.round(a * 100), 0) / 100,
    catchUpPrefill,
    isMonthly,
    periodMonth: r.periodMonth ? dateToMonthKey(r.periodMonth) : null,
    monthOptions,
  };
}
