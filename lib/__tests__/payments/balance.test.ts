import { describe, it, expect } from "vitest";
import { computeBalance, describeBalance } from "@/lib/payments/balance";

describe("computeBalance", () => {
  it("is untracked when no total has been agreed", () => {
    expect(computeBalance(null, [5000])).toEqual({ kind: "untracked" });
  });

  it("subtracts approved payments from the total", () => {
    expect(computeBalance(20000, [5000, 3000])).toEqual({
      kind: "tracked",
      totalDue: 20000,
      paid: 8000,
      remaining: 12000,
    });
  });

  // Assert the whole object, not `.remaining`: Balance is a discriminated
  // union and TypeScript cannot narrow a property off the bare return value,
  // so `computeBalance(...).remaining` fails `tsc --noEmit` even though it
  // runs fine under vitest.
  it("reports zero remaining when settled exactly", () => {
    expect(computeBalance(20000, [20000])).toEqual({
      kind: "tracked",
      totalDue: 20000,
      paid: 20000,
      remaining: 0,
    });
  });

  // Not clamped: an admin needs to see that a student sent too much, because
  // the resolution is a refund or a credit, not a silent zero.
  it("reports a negative remainder when the student overpaid", () => {
    expect(computeBalance(20000, [20500])).toEqual({
      kind: "tracked",
      totalDue: 20000,
      paid: 20500,
      remaining: -500,
    });
  });

  it("treats no payments as nothing paid", () => {
    expect(computeBalance(20000, [])).toEqual({
      kind: "tracked",
      totalDue: 20000,
      paid: 0,
      remaining: 20000,
    });
  });

  // Verified failure before the fix: summing these three floats left
  // remaining = 3.64e-12 instead of 0, because plain float addition does not
  // settle exactly even though the centavos do.
  it("settles exactly at centavo precision instead of leaving a float residual", () => {
    const balance = computeBalance(19603, [4752.07, 13870.99, 979.94]);
    expect(balance).toEqual({
      kind: "tracked",
      totalDue: 19603,
      paid: 19603,
      remaining: 0,
    });
    expect(describeBalance(balance)).toBe("Fully paid. ₱19,603 of ₱19,603.");
  });
});

describe("describeBalance", () => {
  it("says nothing numeric when untracked", () => {
    expect(describeBalance({ kind: "untracked" })).toBe("Balance not tracked");
  });

  it("states paid and remaining", () => {
    expect(describeBalance(computeBalance(20000, [8000]))).toBe(
      "₱8,000 of ₱20,000 paid. ₱12,000 remaining.",
    );
  });

  it("states fully paid on exact settlement", () => {
    expect(describeBalance(computeBalance(20000, [20000]))).toBe(
      "Fully paid. ₱20,000 of ₱20,000.",
    );
  });

  it("states the overpaid amount", () => {
    expect(describeBalance(computeBalance(20000, [20500]))).toBe(
      "Overpaid by ₱500.",
    );
  });
});
