import type { PaymentFrequency, PaymentSource } from "@prisma/client";
import { computeBalance, type Balance } from "@/lib/payments/balance";
import { catchUpPrefill } from "@/lib/payments/catch-up";
import {
  describeMonthlyStanding,
  payableMonths,
  selectableMonths,
} from "@/lib/payments/monthly";
import { monthKeyLabel, type MonthKey } from "@/lib/time/manila";

// Everything the admin student page shows and prefills about one enrollment's
// money. Pure, and built only from the shared billing helpers, so this page
// cannot disagree with the payments pages about a balance or a month.
export type EnrollmentBilling = {
  isMonthly: boolean;
  balance: Balance;
  // Set only on a MONTHLY course, and then rendered instead of `balance`.
  monthlyLine: string | null;
  // Monthly only: the months a payment may be filed against, and the one the
  // form starts on.
  monthOptions: { key: MonthKey; label: string }[];
  defaultMonth: MonthKey | null;
  // Null on a monthly course, which has no single total to edit.
  totalPrefill: string | null;
  // Null hides the already-paid field: the balance is already tracked, or
  // the checkout money is already in the ledger.
  alreadyPaidPrefill: string | null;
};

export function enrollmentBilling(
  enrollment: {
    enrolledAt: Date;
    completedAt: Date | null;
    removedAt: Date | null;
    totalDue: number | null;
    // APPROVED rows only.
    payments: {
      amount: number;
      source: PaymentSource;
      periodMonth: MonthKey | null;
    }[];
    course: {
      id: string;
      tuitionFee: number | null;
      paymentFrequency: PaymentFrequency | null;
    };
    purchase: {
      amountPaid: number;
      items: { courseId: string; tuitionFee: number | null }[];
    } | null;
  },
  now: Date,
): EnrollmentBilling {
  const { course, payments } = enrollment;
  const balance = computeBalance(
    enrollment.totalDue,
    payments.map((p) => p.amount),
  );

  if (course.paymentFrequency === "MONTHLY") {
    const matrixPayments = payments.map((p) => ({
      amount: p.amount,
      periodMonth: p.periodMonth,
      status: "APPROVED" as const,
    }));
    const withFee = { ...enrollment, course: { tuitionFee: course.tuitionFee } };
    const payable = payableMonths(enrollment, now);
    return {
      isMonthly: true,
      balance,
      monthlyLine: describeMonthlyStanding(withFee, matrixPayments, now),
      monthOptions: payable.map((key) => ({ key, label: monthKeyLabel(key) })),
      // The oldest month still owed is the one an admin is most likely
      // recording. With nothing owed, the latest payable month.
      defaultMonth:
        selectableMonths(withFee, matrixPayments, now)[0]?.key ??
        payable[payable.length - 1] ??
        null,
      totalPrefill: null,
      alreadyPaidPrefill: null,
    };
  }

  const catchUp = catchUpPrefill({
    totalDue: enrollment.totalDue,
    hasCheckoutPayment: payments.some((p) => p.source === "CHECKOUT"),
    course,
    purchase: enrollment.purchase,
  });
  return {
    isMonthly: false,
    balance,
    monthlyLine: null,
    monthOptions: [],
    defaultMonth: null,
    totalPrefill: catchUp?.totalDue ?? String(enrollment.totalDue),
    alreadyPaidPrefill: catchUp?.alreadyPaid ?? null,
  };
}
