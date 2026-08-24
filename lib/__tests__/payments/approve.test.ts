import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    payment: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
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
  sendPaymentApprovalEmail,
  sendPaymentRejectionEmail,
} from "@/lib/payments/email";
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
    totalDue: "unused",
    course: { title: "Tajweed Basics" },
    user: { email: "s@example.com", firstName: "Sam" },
  },
};

// A double distinct from `db`, so assertions on the transaction's writes can
// tell "ran inside the transaction callback" apart from "ran on `db`
// directly". Passing `db` itself as `tx` would let a rewrite with two
// sequential, unguarded, non-atomic writes on `db` pass the same assertions
// as a real single-transaction implementation.
let tx: {
  payment: {
    updateMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  enrollment: { update: ReturnType<typeof vi.fn> };
};

describe("approvePaymentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      userId: "admin1",
      role: "ADMIN",
    } as never);

    tx = {
      payment: { updateMany: vi.fn(), create: vi.fn() },
      enrollment: { update: vi.fn() },
    };
    // Run the transaction callback against the distinct `tx` double above,
    // so the logic inside the transaction actually executes, and any write
    // that escaped the callback onto `db` directly would be caught below.
    vi.mocked(db.$transaction).mockImplementation(((
      cb: (tx: unknown) => unknown,
    ) => cb(tx)) as unknown as typeof db.$transaction);
    vi.mocked(db.payment.findUnique).mockResolvedValue(paymentRow as never);
  });

  it("marks the payment approved and sets the chosen enrollment status in one transaction", async () => {
    tx.payment.updateMany.mockResolvedValue({ count: 1 });
    tx.enrollment.update.mockResolvedValue({});

    await expect(
      approvePaymentAction({ error: null }, approveForm("p1", "FULLY_PAID")),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", status: "PENDING" },
      data: expect.objectContaining({
        status: "APPROVED",
        reviewedById: "admin1",
      }),
    });
    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { paymentStatus: "FULLY_PAID" },
    });
    // Neither write may land directly on `db` - only inside the transaction.
    expect(db.payment.updateMany).not.toHaveBeenCalled();
    expect(db.enrollment.update).not.toHaveBeenCalled();
  });

  it("keeps the enrollment partially paid when the admin chooses that", async () => {
    tx.payment.updateMany.mockResolvedValue({ count: 1 });
    tx.enrollment.update.mockResolvedValue({});

    await expect(
      approvePaymentAction(
        { error: null },
        approveForm("p1", "PARTIALLY_PAID"),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { paymentStatus: "PARTIALLY_PAID" },
    });
  });

  it("refuses a second approval and leaves the enrollment untouched", async () => {
    tx.payment.updateMany.mockResolvedValue({ count: 0 });

    const result = await approvePaymentAction(
      { error: null },
      approveForm("p1", "FULLY_PAID"),
    );

    expect(result.error).toBe("This payment has already been processed.");
    expect(tx.enrollment.update).not.toHaveBeenCalled();
  });

  it("requires an explicit resulting payment status", async () => {
    const f = new FormData();
    f.set("id", "p1");
    const result = await approvePaymentAction({ error: null }, f);

    expect(result.error).toBe("Please select the resulting payment status.");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rolls back and reports a database error when the enrollment write fails", async () => {
    tx.payment.updateMany.mockResolvedValue({ count: 1 });
    tx.enrollment.update.mockRejectedValue(new Error("db down"));

    const result = await approvePaymentAction(
      { error: null },
      approveForm("p1", "FULLY_PAID"),
    );

    expect(result).toEqual({
      error: "A database error occurred. Please try again.",
    });
    // The enrollment write's rejection must propagate out of the
    // transaction callback to `$transaction` itself - that propagation is
    // exactly what a real database relies on to roll back the payment
    // write alongside it, rather than leaving it half-landed.
    await expect(
      vi.mocked(db.$transaction).mock.results[0]!.value,
    ).rejects.toThrow("db down");
    expect(sendPaymentApprovalEmail).not.toHaveBeenCalled();
  });

  it("treats email failure as non-fatal after a successful approval", async () => {
    tx.payment.updateMany.mockResolvedValue({ count: 1 });
    tx.enrollment.update.mockResolvedValue({});
    vi.mocked(sendPaymentApprovalEmail).mockRejectedValue(
      new Error("smtp down"),
    );

    const result = await approvePaymentAction(
      { error: null },
      approveForm("p1", "FULLY_PAID"),
    );

    expect(result).toEqual({
      error:
        "Payment approved but email delivery failed. Contact the student directly.",
      success: true,
    });
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

  it("refuses to reject an already-processed payment", async () => {
    vi.mocked(db.payment.updateMany).mockResolvedValue({ count: 0 } as never);
    const f = new FormData();
    f.set("id", "p1");
    f.set("reason", "Proof is unreadable.");

    const result = await rejectPaymentAction({ error: null }, f);

    expect(result.error).toBe("This payment has already been processed.");
    expect(sendPaymentRejectionEmail).not.toHaveBeenCalled();
  });
});

describe("approvePaymentAction starting to track an untracked enrollment", () => {
  beforeEach(() => {
    // Clears call history left over from earlier tests in this file
    // (including on `tx`, whose mocks are registered globally) and restores
    // sendPaymentApprovalEmail, which a prior test left rejecting; these
    // tests exercise the success path.
    vi.clearAllMocks();
    vi.mocked(sendPaymentApprovalEmail).mockResolvedValue(undefined);
    vi.mocked(db.payment.findUnique).mockResolvedValue({
      enrollmentId: "e1",
      enrollment: {
        totalDue: null,
        purchaseId: "p1",
        purchase: { paymentProofUrl: "purchase/p1/proof.jpg" },
        course: { title: "Tajweed Basics" },
        user: { email: "s@example.com", firstName: "Sam" },
      },
    } as never);
  });

  it("writes the total and a catch-up ledger row in one transaction", async () => {
    const f = approveForm("pay1", "PARTIALLY_PAID");
    f.set("totalDue", "20000");
    f.set("alreadyPaid", "5000");

    await expect(approvePaymentAction({ error: null }, f)).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { paymentStatus: "PARTIALLY_PAID", totalDue: 20000 },
    });
    expect(tx.payment.create).toHaveBeenCalledWith({
      data: {
        enrollmentId: "e1",
        purchaseId: "p1",
        amount: 5000,
        proofUrl: "purchase/p1/proof.jpg",
        status: "APPROVED",
        source: "CHECKOUT",
        reviewedById: "admin1",
        reviewedAt: expect.any(Date),
      },
    });
  });

  // Leaving the total blank must keep behaving exactly as it did before
  // balances existed, so an admin who does not want this is never forced into it.
  it("leaves the enrollment untracked when the total is blank", async () => {
    const f = approveForm("pay1", "PARTIALLY_PAID");
    f.set("totalDue", "");
    f.set("alreadyPaid", "");

    await expect(approvePaymentAction({ error: null }, f)).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { paymentStatus: "PARTIALLY_PAID" },
    });
    expect(tx.payment.create).not.toHaveBeenCalled();
  });
});
