import { describe, it, expect } from "vitest";
import {
  paymentStatusFromType,
  paymentTypeFromStatus,
  isPayLater,
} from "@/lib/purchases/payment";

describe("paymentStatusFromType", () => {
  it("maps FULL to FULLY_PAID", () => {
    expect(paymentStatusFromType("FULL")).toBe("FULLY_PAID");
  });
  it("maps PARTIAL to PARTIALLY_PAID", () => {
    expect(paymentStatusFromType("PARTIAL")).toBe("PARTIALLY_PAID");
  });
});

describe("paymentTypeFromStatus", () => {
  it("maps FULLY_PAID to FULL", () => {
    expect(paymentTypeFromStatus("FULLY_PAID")).toBe("FULL");
  });

  it("maps PARTIALLY_PAID to PARTIAL", () => {
    expect(paymentTypeFromStatus("PARTIALLY_PAID")).toBe("PARTIAL");
  });
});

describe("isPayLater", () => {
  it("is true when no proof was submitted", () => {
    expect(isPayLater({ paymentProofUrl: null })).toBe(true);
  });

  it("is false when a proof was submitted", () => {
    expect(isPayLater({ paymentProofUrl: "proof/p1/proof.jpg" })).toBe(false);
  });
});
