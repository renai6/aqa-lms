import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    purchase: { findUnique: vi.fn(), updateMany: vi.fn() },
    enrollment: { findUnique: vi.fn(), create: vi.fn() },
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

function form(id: string) {
  const f = new FormData();
  f.set("id", id);
  return f;
}

// A purchase item's course can be archived while the purchase still sits
// PENDING. Approving it afterwards must not create an enrollment the student
// can never see — the whole approval should roll back with a clear reason.
describe("approvePurchaseAction blocks enrolling into an archived course", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      userId: "admin1",
      role: "ADMIN",
    } as never);

    // Run the transaction callback against a tx mock mirroring db, so the
    // guard logic inside the transaction actually executes.
    vi.mocked(db.$transaction).mockImplementation(
      ((cb: (tx: typeof db) => unknown) => cb(db)) as unknown as typeof db.$transaction,
    );
    vi.mocked(db.purchase.updateMany).mockResolvedValue({ count: 1 } as never);
  });

  it("rolls back and returns a clear error when a purchase item's course is archived", async () => {
    vi.mocked(db.purchase.findUnique).mockResolvedValue({
      paymentType: "FULL",
      user: { id: "u1", email: "s@example.com", firstName: "Sam" },
      items: [
        {
          courseId: "c1",
          course: { title: "Tajweed Basics", archivedAt: new Date() },
        },
      ],
    } as never);

    const result = await approvePurchaseAction({ error: null }, form("p1"));

    expect(result.error).toContain("Tajweed Basics");
    expect(result.error).toContain("archived");
    expect(db.enrollment.create).not.toHaveBeenCalled();
  });

  it("enrolls normally when the course is active", async () => {
    vi.mocked(db.purchase.findUnique).mockResolvedValue({
      paymentType: "FULL",
      user: { id: "u1", email: "s@example.com", firstName: "Sam" },
      items: [
        { courseId: "c1", course: { title: "Tajweed Basics", archivedAt: null } },
      ],
    } as never);
    vi.mocked(db.enrollment.findUnique).mockResolvedValue(null as never);
    vi.mocked(db.batch.findFirst).mockResolvedValue(null as never);
    vi.mocked(db.enrollment.create).mockResolvedValue({} as never);

    await expect(
      approvePurchaseAction({ error: null }, form("p1")),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(db.enrollment.create).toHaveBeenCalledTimes(1);
  });
});
