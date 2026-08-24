import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    purchase: { findUnique: vi.fn(), updateMany: vi.fn() },
    enrollment: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    payment: { create: vi.fn() },
    batch: { findFirst: vi.fn() },
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
vi.mock("@/lib/purchases/email", () => ({
  sendPurchaseApprovalEmail: vi.fn(),
  sendPurchaseRejectionEmail: vi.fn(),
}));

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { approvePurchaseAction } from "@/app/(admin)/admin/purchases/[id]/actions";

let tx: {
  purchase: { updateMany: ReturnType<typeof vi.fn> };
  enrollment: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  payment: { create: ReturnType<typeof vi.fn> };
  batch: { findFirst: ReturnType<typeof vi.fn> };
};

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const purchase = {
  paymentType: "FULL",
  amountPaid: { toNumber: () => 1000 },
  paymentProofUrl: "purchase/p1/proof.jpg",
  user: { id: "u1", email: "s@example.com", firstName: "Sam" },
  items: [{ courseId: "c1", course: { title: "Marhala 1", archivedAt: null } }],
};

const approve = () =>
  approvePurchaseAction(
    { error: null },
    form({ id: "p1", totalDue_c1: "10000", applied_c1: "1000" }),
  );

// A removed student who buys the course again gets their original enrollment
// back rather than a duplicate-key failure, because @@unique([userId, courseId])
// means the removed row still owns the slot.
describe("approving a purchase for a removed enrollment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      userId: "admin1",
      role: "ADMIN",
    } as never);

    tx = {
      purchase: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      enrollment: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "e-new" }),
        update: vi.fn().mockResolvedValue({ id: "e-old" }),
      },
      payment: { create: vi.fn().mockResolvedValue({ id: "pay1" }) },
      batch: { findFirst: vi.fn().mockResolvedValue({ id: "b1" }) },
    };
    vi.mocked(db.$transaction).mockImplementation(((
      cb: (t: unknown) => unknown,
    ) => cb(tx)) as unknown as typeof db.$transaction);
    vi.mocked(db.purchase.findUnique).mockResolvedValue(purchase as never);
  });

  it("reactivates the removed row instead of creating a second one", async () => {
    tx.enrollment.findUnique.mockResolvedValue({
      id: "e-old",
      removedAt: new Date("2026-08-01"),
    });

    await expect(approve()).rejects.toThrow("NEXT_REDIRECT");

    expect(tx.enrollment.create).not.toHaveBeenCalled();
    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id: "e-old" },
      data: {
        removedAt: null,
        removedReason: null,
        paymentStatus: "FULLY_PAID",
        purchaseId: "p1",
        batchId: "b1",
        totalDue: 10000,
      },
    });
  });

  it("puts the new money in the ledger against the revived enrollment", async () => {
    tx.enrollment.findUnique.mockResolvedValue({
      id: "e-old",
      removedAt: new Date("2026-08-01"),
    });

    await expect(approve()).rejects.toThrow("NEXT_REDIRECT");

    expect(tx.payment.create).toHaveBeenCalledWith({
      data: {
        enrollmentId: "e-old",
        purchaseId: "p1",
        amount: 1000,
        proofUrl: "purchase/p1/proof.jpg",
        status: "APPROVED",
        source: "CHECKOUT",
        reviewedById: "admin1",
        reviewedAt: expect.any(Date),
      },
    });
  });

  it("still skips an enrollment that is active, leaving it untouched", async () => {
    tx.enrollment.findUnique.mockResolvedValue({
      id: "e-old",
      removedAt: null,
    });

    await expect(approve()).rejects.toThrow("NEXT_REDIRECT");

    expect(tx.enrollment.create).not.toHaveBeenCalled();
    expect(tx.enrollment.update).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });
});
