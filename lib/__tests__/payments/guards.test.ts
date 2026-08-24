import { describe, it, expect } from "vitest";
import { canAddPayment } from "@/lib/payments/guards";
import { computeBalance } from "@/lib/payments/balance";

const active = {
  paymentStatus: "PARTIALLY_PAID" as const,
  course: { archivedAt: null },
  balance: { kind: "untracked" as const },
};

describe("canAddPayment", () => {
  it("allows a partially paid enrollment in an active course with no payments", () => {
    expect(canAddPayment(active, [])).toEqual({ ok: true });
  });

  it("allows a new payment after the last one was rejected", () => {
    expect(canAddPayment(active, [{ status: "REJECTED" }])).toEqual({
      ok: true,
    });
  });

  it("allows a new payment after an earlier one was approved", () => {
    expect(canAddPayment(active, [{ status: "APPROVED" }])).toEqual({
      ok: true,
    });
  });

  it("refuses when the enrollment does not exist or is not the student's", () => {
    const r = canAddPayment(null, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("Enrollment not found.");
  });

  it("refuses an untracked enrollment marked fully paid", () => {
    const r = canAddPayment({ ...active, paymentStatus: "FULLY_PAID" }, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("This enrollment is already fully paid.");
  });

  it("refuses when the tracked balance is settled", () => {
    const r = canAddPayment(
      { ...active, balance: computeBalance(20000, [20000]) },
      [],
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("This enrollment is already fully paid.");
  });

  it("refuses when the student overpaid", () => {
    const r = canAddPayment(
      { ...active, balance: computeBalance(20000, [20500]) },
      [],
    );
    expect(r.ok).toBe(false);
  });

  // Verified failure before the fix: an admin who picks "Fully paid" on the
  // approve form while a balance remains left the student permanently unable to
  // settle it, with the dashboard hiding the enrollment and no reason shown.
  it("allows paying the rest when the ledger disagrees with a FULLY_PAID label", () => {
    expect(
      canAddPayment(
        {
          ...active,
          paymentStatus: "FULLY_PAID",
          balance: computeBalance(20000, [8000]),
        },
        [],
      ),
    ).toEqual({ ok: true });
  });

  it("refuses when the course is archived", () => {
    const r = canAddPayment(
      { ...active, course: { archivedAt: new Date() } },
      [],
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("This course is no longer available.");
  });

  it("refuses when a payment is already awaiting review", () => {
    const r = canAddPayment(active, [
      { status: "REJECTED" },
      { status: "PENDING" },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.reason).toBe("You already have a payment awaiting review.");
  });
});
