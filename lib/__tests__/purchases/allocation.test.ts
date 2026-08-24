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

  // The shares prefill a form whose submitted values are validated against
  // amountPaid at centavo precision, so that is the guarantee that matters.
  // Strict float equality on the raw sum is not achievable and not claimed.
  it("reconciles to the amount paid at centavo precision", () => {
    const shares = allocate(1000, [10000, 20000, 30000]);
    const sum = shares.reduce((a, b) => a + b, 0);
    expect(Math.round(sum * 100)).toBe(100000);
  });

  it("gives the rounding remainder to the highest-fee course", () => {
    expect(allocate(1000, [10000, 20000, 30000])).toEqual([
      166.67, 333.33, 500,
    ]);
  });

  // Three equal fees cannot divide 100 evenly, so this is the case where the
  // drift correction fires. Without it the shares would total 99.99.
  it("hands the leftover centavo to a share when the split does not divide evenly", () => {
    const shares = allocate(100, [10000, 10000, 10000]);
    expect(shares).toEqual([33.34, 33.33, 33.33]);
    expect(Math.round(shares.reduce((a, b) => a + b, 0) * 100)).toBe(10000);
  });

  it("returns an empty array for no courses", () => {
    expect(allocate(1000, [])).toEqual([]);
  });
});
