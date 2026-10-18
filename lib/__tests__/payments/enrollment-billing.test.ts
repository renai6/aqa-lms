import { describe, it, expect } from "vitest";
import { enrollmentBilling } from "@/lib/payments/enrollment-billing";

// 18 October 2026 in Manila.
const now = new Date("2026-10-18T04:00:00Z");

function enrollment(overrides: Record<string, unknown> = {}) {
  return {
    enrolledAt: new Date("2026-08-05T02:00:00Z"),
    completedAt: null,
    removedAt: null,
    totalDue: 20000,
    payments: [{ amount: 15000, source: "CHECKOUT" as const, periodMonth: null }],
    course: { id: "c1", tuitionFee: 20000, paymentFrequency: "ONE_TIME" as const },
    purchase: null,
    ...overrides,
  } as Parameters<typeof enrollmentBilling>[0];
}

describe("enrollmentBilling", () => {
  it("describes a tracked balance and prefills the current total", () => {
    expect(enrollmentBilling(enrollment(), now)).toEqual({
      isMonthly: false,
      balance: { kind: "tracked", totalDue: 20000, paid: 15000, remaining: 5000 },
      monthlyLine: null,
      monthOptions: [],
      defaultMonth: null,
      totalPrefill: "20000",
      alreadyPaidPrefill: null,
    });
  });

  it("offers the catch-up on an untracked enrollment with no checkout row", () => {
    const billing = enrollmentBilling(
      enrollment({
        totalDue: null,
        payments: [],
        purchase: {
          amountPaid: 9000,
          items: [
            { courseId: "c1", tuitionFee: 20000 },
            { courseId: "c2", tuitionFee: 10000 },
          ],
        },
      }),
      now,
    );
    expect(billing.balance).toEqual({ kind: "untracked" });
    expect(billing.totalPrefill).toBe("20000");
    expect(billing.alreadyPaidPrefill).toBe("6000");
  });

  it("hides already-paid once the checkout money is in the ledger", () => {
    const billing = enrollmentBilling(enrollment({ totalDue: null }), now);
    expect(billing.alreadyPaidPrefill).toBeNull();
  });

  describe("on a monthly course", () => {
    const monthly = (overrides: Record<string, unknown> = {}) =>
      enrollment({
        totalDue: null,
        course: { id: "c1", tuitionFee: 1000, paymentFrequency: "MONTHLY" },
        payments: [{ amount: 1000, source: "CHECKOUT", periodMonth: "2026-08" }],
        ...overrides,
      });

    it("reads the monthly line and offers every payable month", () => {
      const billing = enrollmentBilling(monthly(), now);
      expect(billing.isMonthly).toBe(true);
      expect(billing.monthlyLine).toBe(
        "₱2,000.00 due for September and October 2026",
      );
      expect(billing.monthOptions.map((m) => m.key)).toEqual([
        "2026-08",
        "2026-09",
        "2026-10",
        "2026-11",
      ]);
    });

    // The month an admin is most likely recording is the oldest one owed.
    it("defaults to the oldest unsettled month", () => {
      expect(enrollmentBilling(monthly(), now).defaultMonth).toBe("2026-09");
    });

    it("defaults to next month when everything owed is settled", () => {
      const billing = enrollmentBilling(
        monthly({
          payments: ["2026-08", "2026-09", "2026-10"].map((periodMonth) => ({
            amount: 1000,
            source: "ADMIN",
            periodMonth,
          })),
        }),
        now,
      );
      expect(billing.defaultMonth).toBe("2026-11");
    });

    // A legacy monthly row can still carry a lifetime total. It is never
    // offered for editing.
    it("never offers a total, even on a legacy row that carries one", () => {
      const billing = enrollmentBilling(monthly({ totalDue: 5000 }), now);
      expect(billing.totalPrefill).toBeNull();
      expect(billing.alreadyPaidPrefill).toBeNull();
    });
  });
});
