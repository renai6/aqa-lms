import { describe, it, expect } from "vitest";
import { allocate } from "@/lib/purchases/allocation";

describe("allocate", () => {
  it("gives a single course the whole amount", () => {
    expect(allocate(5000, [20000])).toEqual([5000]);
  });

  it("splits proportionally by fee", () => {
    expect(allocate(3000, [10000, 20000])).toEqual([1000, 2000]);
  });

  it("splits evenly when any fee is missing", () => {
    expect(allocate(3000, [10000, null])).toEqual([1500, 1500]);
  });

  it("splits evenly when every fee is zero", () => {
    expect(allocate(1000, [0, 0])).toEqual([500, 500]);
  });

  // The shares prefill a form that is validated to sum to amountPaid, so a
  // split that loses a centavo to rounding would make the prefill unusable.
  it("reconciles exactly when the division does not come out round", () => {
    const shares = allocate(1000, [10000, 20000, 30000]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it("gives the rounding remainder to the highest-fee course", () => {
    expect(allocate(1000, [10000, 20000, 30000])).toEqual([
      166.67, 333.33, 500,
    ]);
  });

  it("returns an empty array for no courses", () => {
    expect(allocate(1000, [])).toEqual([]);
  });
});
