import { describe, it, expect } from "vitest";
import { canAddPayment, isSettled } from "@/lib/payments/guards";

const monthlyEnrollment = {
  paymentStatus: "PARTIALLY_PAID" as const,
  course: { archivedAt: null, paymentFrequency: "MONTHLY" as const },
  balance: { kind: "untracked" as const },
};

const oneTimeEnrollment = {
  paymentStatus: "PARTIALLY_PAID" as const,
  course: { archivedAt: null, paymentFrequency: "ONE_TIME" as const },
  balance: { kind: "untracked" as const },
};

describe("canAddPayment on a monthly enrollment", () => {
  it("allows a second submission for a different month", () => {
    // A student catching up on three missed months has three proofs to
    // upload. The old rule made them wait for an admin between each one.
    const result = canAddPayment(
      monthlyEnrollment,
      [{ status: "PENDING", periodMonth: "2026-08" }],
      "2026-09",
    );
    expect(result).toEqual({ ok: true });
  });

  it("still rejects a second submission for the same month", () => {
    // This is the double-count the rule was written to prevent: two tabs or a
    // double-click otherwise create two rows for the same money.
    const result = canAddPayment(
      monthlyEnrollment,
      [{ status: "PENDING", periodMonth: "2026-09" }],
      "2026-09",
    );
    expect(result).toEqual({
      ok: false,
      reason: "You already have a payment for this month awaiting review.",
    });
  });

  it("still rejects when the course is archived", () => {
    const result = canAddPayment(
      {
        ...monthlyEnrollment,
        course: { archivedAt: new Date(), paymentFrequency: "MONTHLY" },
      },
      [],
      "2026-09",
    );
    expect(result.ok).toBe(false);
  });
});

describe("canAddPayment on a non-monthly enrollment", () => {
  it("still rejects any second submission while one is pending", () => {
    const result = canAddPayment(
      oneTimeEnrollment,
      [{ status: "PENDING", periodMonth: null }],
      null,
    );
    expect(result).toEqual({
      ok: false,
      reason: "You already have a payment awaiting review.",
    });
  });
});

describe("isSettled", () => {
  it("never settles a monthly enrollment, even one marked FULLY_PAID", () => {
    // The approve form makes the admin pick PARTIALLY_PAID or FULLY_PAID on
    // every approval. Picking FULLY_PAID used to lock a monthly student out
    // of paying forever, with "This enrollment is already fully paid" and no
    // way forward. It is not fully paid; it accrues another month shortly.
    expect(
      isSettled({
        paymentStatus: "FULLY_PAID",
        balance: { kind: "untracked" },
        paymentFrequency: "MONTHLY",
      }),
    ).toBe(false);
  });

  it("still settles a FULLY_PAID one-time enrollment", () => {
    expect(
      isSettled({
        paymentStatus: "FULLY_PAID",
        balance: { kind: "untracked" },
        paymentFrequency: "ONE_TIME",
      }),
    ).toBe(true);
  });

  it("still lets a tracked ledger outrank the FULLY_PAID label", () => {
    expect(
      isSettled({
        paymentStatus: "FULLY_PAID",
        balance: { kind: "tracked", totalDue: 5000, paid: 3000, remaining: 2000 },
        paymentFrequency: null,
      }),
    ).toBe(false);
  });
});
