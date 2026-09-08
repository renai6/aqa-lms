import { describe, it, expect } from "vitest";
import {
  describeMonthlyStanding,
  type MatrixPayment,
} from "@/lib/payments/monthly";

const NOW = new Date("2026-09-08T10:00:00+08:00");

describe("describeMonthlyStanding", () => {
  const enrollment = (
    over: {
      enrolledAt?: Date;
      completedAt?: Date | null;
      removedAt?: Date | null;
      tuitionFee?: number | null;
    } = {},
  ) => ({
    enrolledAt: over.enrolledAt ?? new Date("2026-06-12T09:00:00+08:00"),
    completedAt: over.completedAt ?? null,
    removedAt: over.removedAt ?? null,
    // `"tuitionFee" in over`, not `??`: a caller passing `tuitionFee: null`
    // means "no fee", and `??` would treat that null as "unset" and fall
    // back to the 1500 default instead.
    course: { tuitionFee: "tuitionFee" in over ? (over.tuitionFee ?? null) : 1500 },
  });

  const paymentFor = (
    month: string,
    amount: number,
    status: MatrixPayment["status"] = "APPROVED",
  ): MatrixPayment => ({ periodMonth: month, amount, status });

  it("has nothing to state when the course has no tuitionFee", () => {
    expect(
      describeMonthlyStanding(enrollment({ tuitionFee: null }), [], NOW),
    ).toBe("Billed monthly");
  });

  it("reads paid up through the latest month when nothing is outstanding", () => {
    // Enrolled June, owes June through September (NOW). All four settled.
    const payments = [
      paymentFor("2026-06", 1500),
      paymentFor("2026-07", 1500),
      paymentFor("2026-08", 1500),
      paymentFor("2026-09", 1500),
    ];
    expect(describeMonthlyStanding(enrollment(), payments, NOW)).toBe(
      "Paid up through September 2026",
    );
  });

  it("names the one outstanding month, partially paid", () => {
    const payments = [
      paymentFor("2026-06", 1500),
      paymentFor("2026-07", 1500),
      paymentFor("2026-08", 1500),
      paymentFor("2026-09", 800),
    ];
    expect(describeMonthlyStanding(enrollment(), payments, NOW)).toBe(
      "₱800.00 paid for September 2026 · ₱700.00 still due",
    );
  });

  it("names the one outstanding month, nothing paid", () => {
    const payments = [
      paymentFor("2026-06", 1500),
      paymentFor("2026-07", 1500),
      paymentFor("2026-08", 1500),
    ];
    expect(describeMonthlyStanding(enrollment(), payments, NOW)).toBe(
      "₱1,500.00 due for September 2026",
    );
  });

  it("joins two outstanding months, stating the year once", () => {
    const payments = [paymentFor("2026-06", 1500), paymentFor("2026-07", 1500)];
    expect(describeMonthlyStanding(enrollment(), payments, NOW)).toBe(
      "₱3,000.00 due for August and September 2026",
    );
  });

  it("collapses three or more outstanding months to a count", () => {
    const payments = [paymentFor("2026-06", 1500)];
    expect(describeMonthlyStanding(enrollment(), payments, NOW)).toBe(
      "₱4,500.00 due for 3 months",
    );
  });

  it("sums a mix of partial and unpaid months when collapsing to a count", () => {
    // July partial (short 700), August and September fully unpaid.
    const payments = [
      paymentFor("2026-06", 1500),
      paymentFor("2026-07", 800),
    ];
    expect(describeMonthlyStanding(enrollment(), payments, NOW)).toBe(
      "₱3,700.00 due for 3 months",
    );
  });

  it("ignores PENDING and REJECTED payments, and unassigned money", () => {
    const payments = [
      paymentFor("2026-06", 1500),
      paymentFor("2026-07", 1500),
      paymentFor("2026-08", 1500),
      paymentFor("2026-09", 1500, "PENDING"),
      paymentFor("2026-09", 1500, "REJECTED"),
      { periodMonth: null, amount: 1500, status: "APPROVED" as const },
    ];
    expect(describeMonthlyStanding(enrollment(), payments, NOW)).toBe(
      "₱1,500.00 due for September 2026",
    );
  });

  it("stops accruing at removal, so a settled removed enrollment reads paid up through its last owed month", () => {
    const payments = [
      paymentFor("2026-06", 1500),
      paymentFor("2026-07", 1500),
    ];
    expect(
      describeMonthlyStanding(
        enrollment({ removedAt: new Date("2026-07-20T09:00:00+08:00") }),
        payments,
        NOW,
      ),
    ).toBe("Paid up through July 2026");
  });

  it("crosses a year boundary by naming both years", () => {
    const payments = [
      paymentFor("2026-11", 1500),
    ];
    expect(
      describeMonthlyStanding(
        enrollment({
          enrolledAt: new Date("2026-11-05T09:00:00+08:00"),
        }),
        payments,
        new Date("2027-01-05T09:00:00+08:00"),
      ),
    ).toBe("₱3,000.00 due for December 2026 and January 2027");
  });
});
