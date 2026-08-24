import { describe, it, expect } from "vitest";
import { canAddPayment } from "@/lib/payments/guards";

const active = {
  paymentStatus: "PARTIALLY_PAID" as const,
  course: { archivedAt: null },
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

  it("refuses when the enrollment is already fully paid", () => {
    const r = canAddPayment({ ...active, paymentStatus: "FULLY_PAID" }, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("This enrollment is already fully paid.");
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
