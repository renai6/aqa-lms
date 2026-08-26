import { describe, it, expect } from "vitest";
import { registerSchema, createPurchaseSchema } from "@/lib/purchases/schema";

const validRegister = {
  firstName: "Ahmad",
  lastName: "Bayan",
  email: "ahmad@example.com",
  password: "Password123",
  confirmPassword: "Password123",
  gender: "MALE",
  address: "123 Main St",
  contactNumber: "09171234567",
  facebookName: "Ahmad Bayan",
  facebookLink: "https://facebook.com/ahmad",
  studentType: "NEW",
};

describe("registerSchema", () => {
  it("accepts valid input", () => {
    expect(registerSchema.safeParse(validRegister).success).toBe(true);
  });
  it("rejects mismatched passwords", () => {
    const r = registerSchema.safeParse({
      ...validRegister,
      confirmPassword: "nope",
    });
    expect(r.success).toBe(false);
  });
  it("rejects a short password", () => {
    const r = registerSchema.safeParse({
      ...validRegister,
      password: "a1",
      confirmPassword: "a1",
    });
    expect(r.success).toBe(false);
  });
  it("rejects an invalid PH mobile number", () => {
    const r = registerSchema.safeParse({
      ...validRegister,
      contactNumber: "12345",
    });
    expect(r.success).toBe(false);
  });
  it("rejects a non-https facebook link", () => {
    const r = registerSchema.safeParse({
      ...validRegister,
      facebookLink: "http://facebook.com/x",
    });
    expect(r.success).toBe(false);
  });
});

describe("createPurchaseSchema", () => {
  const base = {
    courseIds: ["c1", "c2"],
    paymentType: "FULL",
    amountPaid: 5000,
    payLater: false,
    studentType: "OLD",
  };
  it("accepts a valid OLD-student partial purchase", () => {
    const r = createPurchaseSchema.safeParse({
      ...base,
      paymentType: "PARTIAL",
      amountPaid: 1000,
    });
    expect(r.success).toBe(true);
  });
  it("requires at least one course", () => {
    const r = createPurchaseSchema.safeParse({ ...base, courseIds: [] });
    expect(r.success).toBe(false);
  });
  it("rejects amountPaid <= 0", () => {
    const r = createPurchaseSchema.safeParse({ ...base, amountPaid: 0 });
    expect(r.success).toBe(false);
  });
  it("allows NEW students to pay partially", () => {
    const r = createPurchaseSchema.safeParse({
      ...base,
      studentType: "NEW",
      paymentType: "PARTIAL",
      amountPaid: 1000,
    });
    expect(r.success).toBe(true);
  });
});

const validPurchase = {
  courseIds: ["c1"],
  paymentType: "PARTIAL",
  amountPaid: "5000",
  payLater: false,
  studentType: "OLD",
};

describe("createPurchaseSchema pay-later rules", () => {
  it("accepts a pay-now purchase with a positive amount", () => {
    expect(createPurchaseSchema.safeParse(validPurchase).success).toBe(true);
  });

  it("rejects a pay-now purchase with no amount", () => {
    // FormData yields null for a missing field, which coerces to 0.
    const r = createPurchaseSchema.safeParse({
      ...validPurchase,
      amountPaid: null,
    });
    expect(r.success).toBe(false);
  });

  it("accepts a pay-later purchase with no amount", () => {
    const r = createPurchaseSchema.safeParse({
      ...validPurchase,
      payLater: true,
      amountPaid: null,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.amountPaid).toBe(0);
  });

  it("rejects a pay-later purchase that also carries an amount", () => {
    const r = createPurchaseSchema.safeParse({
      ...validPurchase,
      payLater: true,
      amountPaid: "5000",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a negative amount", () => {
    const r = createPurchaseSchema.safeParse({
      ...validPurchase,
      amountPaid: "-1",
    });
    expect(r.success).toBe(false);
  });
});
