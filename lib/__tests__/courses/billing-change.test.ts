import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { course: { findUnique: vi.fn() }, $transaction: vi.fn() },
}));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: {} }));

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { updateCourseAction } from "@/app/(admin)/admin/courses/actions";

const decimal = (n: number) => ({ toNumber: () => n });

function form(fields: Record<string, string>) {
  const f = new FormData();
  f.set("id", "c1");
  f.set("title", "Tahseen");
  f.set("description", "");
  f.set("courseType", "ONLINE");
  f.set("passingGrade", "75");
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

function current(paymentFrequency: string | null, activeEnrollments = 2) {
  return { paymentFrequency, _count: { enrollments: activeEnrollments } };
}

// A double distinct from `db`, so the assertions can tell writes made inside
// the transaction from writes made on `db` directly.
let tx: {
  course: { update: ReturnType<typeof vi.fn> };
  enrollment: {
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  payment: { create: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSession).mockResolvedValue({ userId: "a1", role: "ADMIN" } as never);
  tx = {
    course: { update: vi.fn().mockResolvedValue({}) },
    enrollment: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    payment: { create: vi.fn() },
  };
  vi.mocked(db.$transaction).mockImplementation(((fn: (t: typeof tx) => unknown) =>
    fn(tx)) as never);
});

describe("changing a course's billing type", () => {
  it("refuses switching an enrolled course to monthly, and saves nothing", async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue(current("ONE_TIME") as never);
    const res = await updateCourseAction(
      { error: null },
      form({ paymentFrequency: "MONTHLY", tuitionFee: "1000" }),
    );
    expect(res.error).toMatch(/cannot switch to monthly billing/);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses monthly to one-time with no fee to use as the total", async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue(current("MONTHLY") as never);
    const res = await updateCourseAction(
      { error: null },
      form({ paymentFrequency: "ONE_TIME" }),
    );
    expect(res.error).toMatch(/Set a tuition fee first/);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("allows any switch on a course nobody is enrolled in", async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue(current("ONE_TIME", 0) as never);
    const res = await updateCourseAction(
      { error: null },
      form({ paymentFrequency: "MONTHLY", tuitionFee: "1000" }),
    );
    expect(res.error).toBeNull();
    expect(tx.course.update).toHaveBeenCalled();
    expect(tx.enrollment.findMany).not.toHaveBeenCalled();
  });

  it("saves an unchanged billing type without touching enrollments", async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue(current("MONTHLY") as never);
    await updateCourseAction(
      { error: null },
      form({ paymentFrequency: "MONTHLY", tuitionFee: "1000" }),
    );
    expect(tx.course.update).toHaveBeenCalled();
    expect(tx.enrollment.findMany).not.toHaveBeenCalled();
  });

  it("refuses an unknown course", async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue(null as never);
    const res = await updateCourseAction({ error: null }, form({}));
    expect(res.error).toBe("Course not found.");
  });

  describe("from monthly to one-time", () => {
    beforeEach(() => {
      vi.mocked(db.course.findUnique).mockResolvedValue(current("MONTHLY") as never);
      tx.enrollment.findMany.mockResolvedValue([
        // Monthly era: checkout money already recorded.
        {
          id: "e1",
          totalDue: null,
          purchaseId: "p1",
          purchase: {
            amountPaid: decimal(1000),
            paymentProofUrl: "proofs/p1.jpg",
            items: [{ course: { id: "c1", tuitionFee: decimal(1000) } }],
          },
          payments: [{ amount: decimal(1000), source: "CHECKOUT" }],
        },
        // Before balance tracking: checkout money only on the purchase.
        {
          id: "e2",
          totalDue: null,
          purchaseId: "p2",
          purchase: {
            amountPaid: decimal(3500),
            paymentProofUrl: "proofs/p2.jpg",
            items: [{ course: { id: "c1", tuitionFee: decimal(1000) } }],
          },
          payments: [],
        },
      ]);
    });

    it("gives each untracked enrollment the new fee, in the same transaction as the save", async () => {
      const res = await updateCourseAction(
        { error: null },
        form({ paymentFrequency: "ONE_TIME", tuitionFee: "3500" }),
      );
      expect(res.error).toBeNull();
      expect(tx.course.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ paymentFrequency: "ONE_TIME", tuitionFee: 3500 }),
        }),
      );
      expect(tx.enrollment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { courseId: "c1", removedAt: null, totalDue: null },
        }),
      );
      expect(tx.enrollment.update).toHaveBeenCalledWith({
        where: { id: "e1" },
        data: { totalDue: 3500, paymentStatus: "PARTIALLY_PAID" },
      });
      expect(tx.enrollment.update).toHaveBeenCalledWith({
        where: { id: "e2" },
        data: { totalDue: 3500, paymentStatus: "FULLY_PAID" },
      });
    });

    it("records only the checkout money that is not in the ledger yet", async () => {
      await updateCourseAction(
        { error: null },
        form({ paymentFrequency: "ONE_TIME", tuitionFee: "3500" }),
      );
      expect(tx.payment.create).toHaveBeenCalledTimes(1);
      expect(tx.payment.create).toHaveBeenCalledWith({
        data: {
          enrollmentId: "e2",
          purchaseId: "p2",
          amount: 3500,
          proofUrl: "proofs/p2.jpg",
          status: "APPROVED",
          source: "CHECKOUT",
          reviewedById: "a1",
          reviewedAt: expect.any(Date),
        },
      });
    });

    it("revalidates the balance surfaces", async () => {
      await updateCourseAction(
        { error: null },
        form({ paymentFrequency: "ONE_TIME", tuitionFee: "3500" }),
      );
      expect(revalidatePath).toHaveBeenCalledWith("/admin/students", "layout");
      expect(revalidatePath).toHaveBeenCalledWith("/admin/payments", "layout");
      expect(revalidatePath).toHaveBeenCalledWith("/student", "layout");
    });
  });
});
