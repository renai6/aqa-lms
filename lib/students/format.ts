import { type CourseType, type EnrollmentStatus } from "@prisma/client";
import { toManilaDateKey } from "@/lib/time/manila";

// A removed enrollment still belongs to the student's history, so admin
// surfaces keep listing the course - marked, so a roster export never reads as
// though the student is still attending it.
export function formatEnrolledCourses(
  enrollments: { courseTitle: string; removedAt: Date | null }[],
): string {
  return enrollments
    .map((e) => (e.removedAt ? `${e.courseTitle} (removed)` : e.courseTitle))
    .join("; ");
}

// Read alongside the Course column, so every enrollment gets a slot in the same
// order - removed ones included, whose removal the Course column already marks.
export function formatEnrolledCourseTypes(
  enrollments: { courseType: CourseType }[],
): string {
  return enrollments
    .map((e) => (e.courseType === "ONLINE" ? "Online" : "On-Site"))
    .join("; ");
}

type PaymentRow = {
  amount: number;
  status: EnrollmentStatus;
  createdAt: Date;
};

// Only APPROVED rows are money received, the same rule `computeBalance` holds
// every other surface to. Filtered here rather than in the query so the
// invariant is provable without a database: the export is the one place that
// would otherwise quietly overstate the academy's takings.
function approved(payments: PaymentRow[]): PaymentRow[] {
  return payments.filter((p) => p.status === "APPROVED");
}

// Positional like the Course Type column: entry N is what the student has
// paid on course N. A course with nothing approved keeps an empty slot, or
// the column stops lining up with Course - and empty is not "0.00", which
// would claim a payment of zero was received.
export function formatAmountsPaid(
  enrollments: { payments: PaymentRow[] }[],
): string {
  return enrollments
    .map((e) => {
      const paid = approved(e.payments);
      if (paid.length === 0) return "";
      // Integer centavos, for the reason lib/payments/balance.ts documents:
      // summing floats leaves residues like 3000.3000000000002, which reads
      // as a wrong amount to anyone checking the figure against a receipt.
      const centavos = paid.reduce(
        (sum, p) => sum + Math.round(p.amount * 100),
        0,
      );
      // Bare digits, deliberately not `peso()`: that formatter is for money on
      // screen, and a currency symbol and thousands separators make the column
      // unsummable once a spreadsheet splits it back into per-course cells.
      return (centavos / 100).toFixed(2);
    })
    .join("; ");
}

// Read alongside Amount Paid: the date of the newest approved payment that the
// amount in the same slot includes.
export function formatLastPaymentDates(
  enrollments: { payments: PaymentRow[] }[],
): string {
  return enrollments
    .map((e) => {
      const paid = approved(e.payments);
      if (paid.length === 0) return "";
      const newest = paid.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
      return toManilaDateKey(newest.createdAt);
    })
    .join("; ");
}
