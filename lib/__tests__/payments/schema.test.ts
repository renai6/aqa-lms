import { describe, it, expect } from "vitest";
import { createPaymentSchema } from "@/lib/payments/schema";
import { validateImageUpload } from "@/lib/uploads/image";

describe("createPaymentSchema", () => {
  const base = { enrollmentId: "e1", amount: 1500 };

  it("accepts a positive amount", () => {
    expect(createPaymentSchema.safeParse(base).success).toBe(true);
  });

  it("coerces a numeric string from the form body", () => {
    const r = createPaymentSchema.safeParse({ ...base, amount: "1500" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.amount).toBe(1500);
  });

  it("rejects a zero amount", () => {
    const r = createPaymentSchema.safeParse({ ...base, amount: 0 });
    expect(r.success).toBe(false);
  });

  it("rejects a negative amount", () => {
    const r = createPaymentSchema.safeParse({ ...base, amount: -100 });
    expect(r.success).toBe(false);
  });

  it("rejects a non-numeric amount", () => {
    const r = createPaymentSchema.safeParse({ ...base, amount: "abc" });
    expect(r.success).toBe(false);
  });

  it("requires an enrollment id", () => {
    const r = createPaymentSchema.safeParse({ ...base, enrollmentId: "" });
    expect(r.success).toBe(false);
  });
});

// The proof image is not part of the zod schema - it is a File, validated by
// the shared uploader. This pins the "proof is required" half of the contract.
describe("proof of payment is required", () => {
  it("rejects a missing file", async () => {
    const r = await validateImageUpload(null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Please select a file to upload.");
  });
});
