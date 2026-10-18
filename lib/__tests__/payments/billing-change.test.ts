import { describe, it, expect } from "vitest";
import {
  billingChange,
  planLumpSumConversion,
} from "@/lib/payments/billing-change";

const enrolled = { activeEnrollments: 3, tuitionFee: 3500 };

describe("billingChange", () => {
  it("has no ledger impact when the billing type is unchanged", () => {
    expect(billingChange("MONTHLY", "MONTHLY", enrolled)).toEqual({ kind: "none" });
  });

  it("has no ledger impact on a course nobody is enrolled in", () => {
    const empty = { activeEnrollments: 0, tuitionFee: null };
    expect(billingChange("ONE_TIME", "MONTHLY", empty)).toEqual({ kind: "none" });
    expect(billingChange("MONTHLY", "YEARLY", empty)).toEqual({ kind: "none" });
  });

  // Every non-monthly course keeps one lifetime total, so moving between them
  // leaves each balance as it was.
  it("has no ledger impact between non-monthly billing types", () => {
    expect(billingChange("ONE_TIME", "YEARLY", enrolled)).toEqual({ kind: "none" });
    expect(billingChange(null, "ONE_TIME", enrolled)).toEqual({ kind: "none" });
    expect(billingChange("YEARLY", null, enrolled)).toEqual({ kind: "none" });
  });

  it("converts monthly enrollments to a one-time total", () => {
    expect(billingChange("MONTHLY", "ONE_TIME", enrolled)).toEqual({ kind: "convert" });
    expect(billingChange("MONTHLY", null, enrolled)).toEqual({ kind: "convert" });
  });

  it("refuses converting to a one-time total without a fee to use", () => {
    expect(
      billingChange("MONTHLY", "ONE_TIME", { activeEnrollments: 3, tuitionFee: null }),
    ).toEqual({
      kind: "refuse",
      reason:
        "Set a tuition fee first. Enrolled students get it as their total when the course stops billing monthly.",
    });
  });

  // A yearly fee is not the whole of what a student owes, so there is no
  // total to convert to.
  it("refuses monthly to yearly while students are enrolled", () => {
    expect(billingChange("MONTHLY", "YEARLY", enrolled)).toEqual({
      kind: "refuse",
      reason:
        "Students are enrolled, so this course cannot switch from monthly to yearly billing: there is no total to give their balances.",
    });
  });

  // Existing payments carry no month, so the matrix would show them all as
  // Unassigned.
  it("refuses switching to monthly while students are enrolled", () => {
    for (const from of ["ONE_TIME", "YEARLY", null] as const) {
      expect(billingChange(from, "MONTHLY", enrolled)).toEqual({
        kind: "refuse",
        reason:
          "Students are enrolled, so this course cannot switch to monthly billing: their payments are not filed against months.",
      });
    }
  });
});

const decimalFree = (overrides: Record<string, unknown> = {}) => ({
  id: "e1",
  totalDue: null,
  payments: [] as { amount: number; source: "SUBMITTED" | "CHECKOUT" | "ADMIN" }[],
  purchase: null,
  ...overrides,
});

describe("planLumpSumConversion", () => {
  const course = { id: "c1", tuitionFee: 3500 };

  it("gives an untracked enrollment the fee as its total", () => {
    expect(planLumpSumConversion([decimalFree()], course)).toEqual([
      { enrollmentId: "e1", totalDue: 3500, catchUp: null, paymentStatus: "PARTIALLY_PAID" },
    ]);
  });

  it("leaves an enrollment that already has a total alone", () => {
    expect(planLumpSumConversion([decimalFree({ totalDue: 5000 })], course)).toEqual([]);
  });

  // The monthly-era case: checkout money is already a CHECKOUT row, and
  // later monthly payments count toward the total too.
  it("counts recorded payments without recording checkout money twice", () => {
    const plan = planLumpSumConversion(
      [
        decimalFree({
          payments: [
            { amount: 1000, source: "CHECKOUT" },
            { amount: 2500, source: "SUBMITTED" },
          ],
          purchase: { amountPaid: 1000, items: [{ courseId: "c1", tuitionFee: 3500 }] },
        }),
      ],
      course,
    );
    expect(plan).toEqual([
      { enrollmentId: "e1", totalDue: 3500, catchUp: null, paymentStatus: "FULLY_PAID" },
    ]);
  });

  // The pre-tracking case: checkout money lives only on the purchase, so it
  // is recorded as this enrollment's share of it, as the Payment dialog
  // prefills.
  it("records unrecorded checkout money as this course's share of the purchase", () => {
    const plan = planLumpSumConversion(
      [
        decimalFree({
          purchase: {
            amountPaid: 5000,
            items: [
              { courseId: "c1", tuitionFee: 3500 },
              { courseId: "c2", tuitionFee: 1500 },
            ],
          },
        }),
      ],
      course,
    );
    expect(plan).toEqual([
      { enrollmentId: "e1", totalDue: 3500, catchUp: 3500, paymentStatus: "FULLY_PAID" },
    ]);
  });

  it("records nothing for a pay-later purchase", () => {
    const plan = planLumpSumConversion(
      [decimalFree({ purchase: { amountPaid: 0, items: [{ courseId: "c1", tuitionFee: 3500 }] } })],
      course,
    );
    expect(plan[0].catchUp).toBeNull();
  });

  // The fee being converted to is the new one, not whatever the purchase item
  // would read from a stale course row.
  it("splits the purchase by the new fee", () => {
    const plan = planLumpSumConversion(
      [
        decimalFree({
          purchase: {
            amountPaid: 3000,
            items: [
              { courseId: "c1", tuitionFee: 1000 },
              { courseId: "c2", tuitionFee: 2000 },
            ],
          },
        }),
      ],
      { id: "c1", tuitionFee: 4000 },
    );
    expect(plan[0].catchUp).toBe(2000);
  });
});
