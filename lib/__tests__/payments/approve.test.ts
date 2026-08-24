import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    payment: { findUnique: vi.fn(), updateMany: vi.fn() },
    enrollment: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("@/lib/payments/email", () => ({
  sendPaymentApprovalEmail: vi.fn(),
  sendPaymentRejectionEmail: vi.fn(),
}));

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import {
  approvePaymentAction,
  rejectPaymentAction,
} from "@/app/(admin)/admin/payments/[id]/actions";

function approveForm(id: string, paymentStatus: string) {
  const f = new FormData();
  f.set("id", id);
  f.set("paymentStatus", paymentStatus);
  return f;
}

const paymentRow = {
  enrollmentId: "e1",
  enrollment: {
    course: { title: "Tajweed Basics" },
    user: { email: "s@example.com", firstName: "Sam" },
  },
};

describe("approvePaymentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      userId: "admin1",
      role: "ADMIN",
    } as never);
    // Run the transaction callback against a tx mock mirroring db, so the
    // logic inside the transaction actually executes.
    vi.mocked(db.$transaction).mockImplementation(((
      cb: (tx: typeof db) => unknown,
    ) => cb(db)) as unknown as typeof db.$transaction);
    vi.mocked(db.payment.findUnique).mockResolvedValue(paymentRow as never);
  });

  it("marks the payment approved and sets the chosen enrollment status in one transaction", async () => {
    vi.mocked(db.payment.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.enrollment.update).mockResolvedValue({} as never);

    await expect(
      approvePaymentAction({ error: null }, approveForm("p1", "FULLY_PAID")),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p1", status: "PENDING" } }),
    );
    expect(db.enrollment.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { paymentStatus: "FULLY_PAID" },
    });
  });

  it("keeps the enrollment partially paid when the admin chooses that", async () => {
    vi.mocked(db.payment.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.enrollment.update).mockResolvedValue({} as never);

    await expect(
      approvePaymentAction(
        { error: null },
        approveForm("p1", "PARTIALLY_PAID"),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(db.enrollment.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { paymentStatus: "PARTIALLY_PAID" },
    });
  });

  it("refuses a second approval and leaves the enrollment untouched", async () => {
    vi.mocked(db.payment.updateMany).mockResolvedValue({ count: 0 } as never);

    const result = await approvePaymentAction(
      { error: null },
      approveForm("p1", "FULLY_PAID"),
    );

    expect(result.error).toBe("This payment has already been processed.");
    expect(db.enrollment.update).not.toHaveBeenCalled();
  });

  it("requires an explicit resulting payment status", async () => {
    const f = new FormData();
    f.set("id", "p1");
    const result = await approvePaymentAction({ error: null }, f);

    expect(result.error).toBe("Please select the resulting payment status.");
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("rejectPaymentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      userId: "admin1",
      role: "ADMIN",
    } as never);
    vi.mocked(db.payment.findUnique).mockResolvedValue(paymentRow as never);
  });

  it("requires a reason", async () => {
    const f = new FormData();
    f.set("id", "p1");
    f.set("reason", "");

    const result = await rejectPaymentAction({ error: null }, f);

    expect(result.error).toBe("A reason is required.");
    expect(db.payment.updateMany).not.toHaveBeenCalled();
  });

  it("stores the reason in adminRemarks", async () => {
    vi.mocked(db.payment.updateMany).mockResolvedValue({ count: 1 } as never);
    const f = new FormData();
    f.set("id", "p1");
    f.set("reason", "Proof is unreadable.");

    await expect(rejectPaymentAction({ error: null }, f)).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(db.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "p1", status: "PENDING" },
        data: expect.objectContaining({
          status: "REJECTED",
          adminRemarks: "Proof is unreadable.",
        }),
      }),
    );
  });
});
