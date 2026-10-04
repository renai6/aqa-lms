import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    payment: { delete: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/uploads/image", () => ({ validateImageUpload: vi.fn() }));
vi.mock("@/lib/payments/queries", () => ({ getEnrollmentForPayment: vi.fn() }));
vi.mock("@/lib/payments/email", () => ({
  sendPaymentConfirmationEmail: vi.fn(),
}));

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { validateImageUpload } from "@/lib/uploads/image";
import { getEnrollmentForPayment } from "@/lib/payments/queries";
import { createPaymentAction } from "@/lib/payments/actions";

let tx: {
  $queryRaw: ReturnType<typeof vi.fn>;
  enrollment: { findUnique: ReturnType<typeof vi.fn> };
  payment: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

function form() {
  const fd = new FormData();
  fd.set("enrollmentId", "e1");
  fd.set("amount", "500");
  return fd;
}

describe("createPaymentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      userId: "s1",
      role: "STUDENT",
    } as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      email: "s@example.com",
      firstName: "Sam",
      isActive: true,
    } as never);
    vi.mocked(getEnrollmentForPayment).mockResolvedValue({
      id: "e1",
      paymentStatus: "PARTIALLY_PAID",
      enrolledAt: new Date("2026-07-01"),
      completedAt: null,
      removedAt: null,
      course: {
        title: "Marhala 1",
        archivedAt: null,
        paymentFrequency: "ONE_TIME",
        tuitionFee: null,
      },
      payments: [],
      balance: { kind: "untracked" },
    } as never);
    vi.mocked(validateImageUpload).mockResolvedValue({
      ok: true,
      buffer: Buffer.from(""),
      ext: "png",
      contentType: "image/png",
    } as never);
    // supabaseAdmin is an empty stub, so a run that gets past the transaction
    // fails its upload and cleans up the row it created.
    vi.mocked(db.payment.delete).mockResolvedValue({} as never);
    vi.spyOn(console, "error").mockImplementation(() => {});

    tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      enrollment: {
        findUnique: vi.fn().mockResolvedValue({ removedAt: null }),
      },
      payment: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "p1" }),
      },
    };
    vi.mocked(db.$transaction).mockImplementation(((
      cb: (t: unknown) => unknown,
    ) => cb(tx)) as unknown as typeof db.$transaction);
  });

  // A course move removes the enrollment and takes its payments to the new
  // course. A submission that passed the earlier read but reached the lock
  // after the move must not leave a pending payment on the removed row.
  it("refuses when the enrollment was removed before the lock was taken", async () => {
    tx.enrollment.findUnique.mockResolvedValue({ removedAt: new Date() });

    const result = await createPaymentAction({ error: null }, form());

    expect(result.error).toBe("Enrollment not found.");
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it("re-reads the locked enrollment and creates the payment when it is live", async () => {
    await createPaymentAction({ error: null }, form());

    expect(tx.enrollment.findUnique).toHaveBeenCalledWith({
      where: { id: "e1" },
      select: { removedAt: true },
    });
    expect(tx.payment.create).toHaveBeenCalled();
  });
});
