import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    purchase: { findUnique: vi.fn(), updateMany: vi.fn() },
    enrollment: { findUnique: vi.fn(), create: vi.fn() },
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

// A double distinct from `db`, so assertions prove the writes happened inside
// the transaction callback rather than on `db` directly.
let tx: {
  purchase: { updateMany: ReturnType<typeof vi.fn> };
  enrollment: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  payment: { create: ReturnType<typeof vi.fn> };
  batch: { findFirst: ReturnType<typeof vi.fn> };
};

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const twoCoursePurchase = {
  paymentType: "PARTIAL",
  amountPaid: { toNumber: () => 3000 },
  paymentProofUrl: "purchase/p1/proof.jpg",
  user: { id: "u1", email: "s@example.com", firstName: "Sam" },
  items: [
    { courseId: "c1", course: { title: "Marhala 1", archivedAt: null } },
    { courseId: "c2", course: { title: "Marhala 2", archivedAt: null } },
  ],
};

describe("approvePurchaseAction records totals and ledger rows", () => {
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
        create: vi
          .fn()
          .mockImplementation(({ data }: { data: { courseId: string } }) =>
            Promise.resolve({ id: `e-${data.courseId}` }),
          ),
      },
      payment: { create: vi.fn().mockResolvedValue({ id: "pay1" }) },
      batch: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    vi.mocked(db.$transaction).mockImplementation(((
      cb: (t: unknown) => unknown,
    ) => cb(tx)) as unknown as typeof db.$transaction);
    vi.mocked(db.purchase.findUnique).mockResolvedValue(
      twoCoursePurchase as never,
    );
  });

  it("writes the entered total onto each new enrollment", async () => {
    await expect(
      approvePurchaseAction(
        { error: null },
        form({
          id: "p1",
          totalDue_c1: "10000",
          applied_c1: "1000",
          totalDue_c2: "20000",
          applied_c2: "2000",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(tx.enrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ courseId: "c1", totalDue: 10000 }),
      }),
    );
  });

  it("creates one approved CHECKOUT payment per enrollment", async () => {
    await expect(
      approvePurchaseAction(
        { error: null },
        form({
          id: "p1",
          totalDue_c1: "10000",
          applied_c1: "1000",
          totalDue_c2: "20000",
          applied_c2: "2000",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(tx.payment.create).toHaveBeenCalledTimes(2);
    expect(tx.payment.create).toHaveBeenCalledWith({
      data: {
        enrollmentId: "e-c1",
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

  it("leaves totalDue null when the admin leaves the total blank", async () => {
    await expect(
      approvePurchaseAction(
        { error: null },
        form({
          id: "p1",
          totalDue_c1: "",
          applied_c1: "1000",
          totalDue_c2: "",
          applied_c2: "2000",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(tx.enrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ courseId: "c1", totalDue: null }),
      }),
    );
  });

  // Accepting a split that does not reconcile would leave the ledger
  // permanently out of step with the money actually received.
  it("refuses approval when the applied amounts do not sum to amountPaid", async () => {
    const result = await approvePurchaseAction(
      { error: null },
      form({
        id: "p1",
        totalDue_c1: "10000",
        applied_c1: "1000",
        totalDue_c2: "20000",
        applied_c2: "1500",
      }),
    );

    expect(result.error).toContain("₱2,500");
    expect(result.error).toContain("₱3,000");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  // The enrollment itself is left alone, but the money the admin allocated to
  // it is still money received and belongs in that enrollment's ledger.
  // Skipping the row understated the balance with no way to recover it.
  it("records the applied money against a course the student is already enrolled in", async () => {
    tx.enrollment.findUnique.mockImplementation(
      ({ where }: { where: { userId_courseId: { courseId: string } } }) =>
        Promise.resolve(
          where.userId_courseId.courseId === "c1" ? { id: "existing" } : null,
        ),
    );

    await expect(
      approvePurchaseAction(
        { error: null },
        form({
          id: "p1",
          totalDue_c1: "10000",
          applied_c1: "1000",
          totalDue_c2: "20000",
          applied_c2: "2000",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(tx.payment.create).toHaveBeenCalledTimes(2);
    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          enrollmentId: "existing",
          amount: 1000,
        }),
      }),
    );
    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ enrollmentId: "e-c2", amount: 2000 }),
      }),
    );
  });
});
