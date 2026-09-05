import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    purchase: { findUnique: vi.fn(), updateMany: vi.fn() },
    enrollment: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    payment: { create: vi.fn() },
    batch: { findFirst: vi.fn(), aggregate: vi.fn(), create: vi.fn() },
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
  batch: {
    findFirst: ReturnType<typeof vi.fn>;
    aggregate: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  course: { findUnique: ReturnType<typeof vi.fn> };
};

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const payLaterPurchase = {
  paymentType: "PAY_LATER",
  amountPaid: { toNumber: () => 0 },
  paymentProofUrl: null,
  user: { id: "u1", email: "s@example.com", firstName: "Sam" },
  items: [{ courseId: "c1", course: { title: "Marhala 1", archivedAt: null } }],
};

// A student reads lesson material, video and recording through
// `enrollment.batchId`. An enrollment written with a null batch shows
// "No materials available" on every lesson and is never backfilled, so
// approval must not be able to produce one.
describe("approvePurchaseAction always puts the enrollment in a batch", () => {
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
        create: vi.fn().mockResolvedValue({ id: "e1" }),
        update: vi.fn().mockResolvedValue({ id: "e1" }),
      },
      payment: { create: vi.fn().mockResolvedValue({ id: "pay1" }) },
      batch: {
        findFirst: vi.fn().mockResolvedValue(null),
        aggregate: vi.fn().mockResolvedValue({ _max: { number: null } }),
        create: vi.fn().mockResolvedValue({ id: "b-new" }),
      },
      course: { findUnique: vi.fn().mockResolvedValue({ courseAlias: null }) },
    };
    vi.mocked(db.$transaction).mockImplementation(((
      cb: (t: unknown) => unknown,
    ) => cb(tx)) as unknown as typeof db.$transaction);

    vi.mocked(db.purchase.findUnique).mockResolvedValue(
      payLaterPurchase as never,
    );
  });

  it("opens a batch for a course that has none, rather than enrolling into null", async () => {
    await expect(
      approvePurchaseAction(
        { error: null },
        form({ id: "p1", totalDue_c1: "10000", applied_c1: "0" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(tx.batch.create).toHaveBeenCalledWith({
      data: { courseId: "c1", number: 34, isActive: true, name: null },
      select: { id: true },
    });
    expect(tx.enrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ batchId: "b-new" }),
      }),
    );
  });

  it("reuses the course's active batch when one is already open", async () => {
    tx.batch.findFirst.mockResolvedValue({ id: "b1" });

    await expect(
      approvePurchaseAction(
        { error: null },
        form({ id: "p1", totalDue_c1: "10000", applied_c1: "0" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(tx.batch.create).not.toHaveBeenCalled();
    expect(tx.enrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ batchId: "b1" }),
      }),
    );
  });

  // A re-purchase revives the removed row in place, and that path wrote the
  // same null batch as a fresh enrollment.
  it("puts a revived enrollment in a batch too", async () => {
    tx.enrollment.findUnique.mockResolvedValue({
      id: "e-old",
      removedAt: new Date(),
    });

    await expect(
      approvePurchaseAction(
        { error: null },
        form({ id: "p1", totalDue_c1: "10000", applied_c1: "0" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(tx.enrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ batchId: "b-new" }),
      }),
    );
  });
});
