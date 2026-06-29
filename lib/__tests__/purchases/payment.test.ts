import { describe, it, expect } from "vitest";
import {
  paymentStatusFromType,
  paymentTypeFromStatus,
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
