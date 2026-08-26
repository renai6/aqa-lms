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

// No proof and a zero amount: exactly what checkout writes for pay later.
const payLaterPurchase = {
  paymentType: "PARTIAL",
  amountPaid: { toNumber: () => 0 },
  paymentProofUrl: null,
  user: { id: "u1", email: "s@example.com", firstName: "Sam" },
  items: [{ courseId: "c1", course: { title: "Marhala 1", archivedAt: null } }],
};

describe("approvePurchaseAction on a pay-later purchase", () => {
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
      payLaterPurchase as never,
    );
  });

  it("enrolls the student with the admin's total and no ledger rows", async () => {
    await expect(
      approvePurchaseAction(
        { error: null },
        form({ id: "p1", totalDue_c1: "10000", applied_c1: "0" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(tx.enrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          courseId: "c1",
          totalDue: 10000,
          paymentStatus: "PARTIALLY_PAID",
        }),
      }),
    );
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it("treats an omitted applied field as zero", async () => {
    await expect(
      approvePurchaseAction(
        { error: null },
        form({ id: "p1", totalDue_c1: "10000" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(tx.enrollment.create).toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it("refuses an applied amount the student never paid", async () => {
    const result = await approvePurchaseAction(
      { error: null },
      form({ id: "p1", totalDue_c1: "10000", applied_c1: "500" }),
    );

    expect(result.error).toContain("but the student paid");
    expect(tx.enrollment.create).not.toHaveBeenCalled();
  });
});
