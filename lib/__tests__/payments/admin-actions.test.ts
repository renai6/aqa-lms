import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    enrollment: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import {
  logAdminPaymentAction,
  setTotalDueAction,
} from "@/lib/payments/admin-actions";

const initial = { error: null };

const decimal = (n: number) => ({ toNumber: () => n });

// The pre-transaction read: who the enrollment belongs to and how its course
// is billed.
function enrollmentRow(overrides: Record<string, unknown> = {}) {
  return {
    userId: "u1",
    courseId: "c1",
    enrolledAt: new Date("2026-08-05T02:00:00Z"),
    completedAt: null,
    removedAt: null,
    purchaseId: "pur1",
    purchase: { paymentProofUrl: "proofs/pur1.jpg" },
    course: { paymentFrequency: "ONE_TIME" },
    ...overrides,
  };
}

// The locked row re-read inside the transaction, which every write decides
// from.
function lockedRow(overrides: Record<string, unknown> = {}) {
  return {
    removedAt: null,
    totalDue: decimal(20000),
    payments: [{ amount: decimal(15000), source: "CHECKOUT" }],
    ...overrides,
  };
}

// A double distinct from `db`, so the assertions can tell writes made inside
// the transaction from writes made on `db` directly.
let tx: {
  $queryRaw: ReturnType<typeof vi.fn>;
  enrollment: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  payment: { create: ReturnType<typeof vi.fn> };
};

function form(fields: Record<string, string>) {
  const fd = new FormData();
  fd.set("enrollmentId", "e1");
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  // 18 October 2026 in Manila.
  vi.setSystemTime(new Date("2026-10-18T04:00:00Z"));
  vi.mocked(getSession).mockResolvedValue({ userId: "a1", role: "ADMIN" } as never);
  vi.mocked(db.enrollment.findUnique).mockResolvedValue(enrollmentRow() as never);
  tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    enrollment: {
      findUnique: vi.fn().mockResolvedValue(lockedRow()),
      update: vi.fn().mockResolvedValue({}),
    },
    payment: { create: vi.fn().mockResolvedValue({}) },
  };
  vi.mocked(db.$transaction).mockImplementation(((fn: (t: typeof tx) => unknown) =>
    fn(tx)) as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("logAdminPaymentAction", () => {
  it("refuses anyone who is not an admin", async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: "s1", role: "STUDENT" } as never);
    const res = await logAdminPaymentAction(initial, form({ amount: "500" }));
    expect(res.error).toBe("Forbidden");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses an amount that is not more than zero", async () => {
    for (const amount of ["0", "-5", "abc", ""]) {
      const res = await logAdminPaymentAction(initial, form({ amount }));
      expect(res.error).toBe("Amount must be greater than 0.");
    }
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a removed enrollment", async () => {
    vi.mocked(db.enrollment.findUnique).mockResolvedValue(
      enrollmentRow({ removedAt: new Date() }) as never,
    );
    const res = await logAdminPaymentAction(initial, form({ amount: "500" }));
    expect(res.error).toBe("This student is removed from the course.");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  // Removed between the page load and the submit, e.g. by a course move that
  // took the payments elsewhere. The locked re-read is what catches it.
  it("refuses an enrollment removed while the admin was typing", async () => {
    tx.enrollment.findUnique.mockResolvedValue(lockedRow({ removedAt: new Date() }));
    const res = await logAdminPaymentAction(initial, form({ amount: "500" }));
    expect(res.error).toBe("This student is removed from the course.");
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it("records an approved ADMIN payment, kept out of the review queue", async () => {
    const res = await logAdminPaymentAction(
      initial,
      form({ amount: "2500", note: "  Cash at the front desk  " }),
    );
    expect(res.error).toBeNull();
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        enrollmentId: "e1",
        amount: 2500,
        proofUrl: "",
        status: "APPROVED",
        source: "ADMIN",
        reviewedById: "a1",
        reviewedAt: expect.any(Date),
        adminRemarks: "Cash at the front desk",
        periodMonth: null,
      }),
    });
  });

  it("refuses a note longer than 200 characters", async () => {
    const res = await logAdminPaymentAction(
      initial,
      form({ amount: "2500", note: "x".repeat(201) }),
    );
    expect(res.error).toBe("Keep the note under 200 characters.");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("stores a blank note as no note", async () => {
    await logAdminPaymentAction(initial, form({ amount: "2500", note: "   " }));
    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ adminRemarks: null }),
    });
  });

  it("marks a tracked enrollment fully paid once the payment settles it", async () => {
    await logAdminPaymentAction(initial, form({ amount: "5000" }));
    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { paymentStatus: "FULLY_PAID" },
    });
  });

  it("keeps a tracked enrollment partially paid while money remains", async () => {
    await logAdminPaymentAction(initial, form({ amount: "1000" }));
    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { paymentStatus: "PARTIALLY_PAID" },
    });
  });

  it("leaves an untracked enrollment's manual status alone", async () => {
    tx.enrollment.findUnique.mockResolvedValue(lockedRow({ totalDue: null }));
    await logAdminPaymentAction(initial, form({ amount: "1000" }));
    expect(tx.payment.create).toHaveBeenCalled();
    expect(tx.enrollment.update).not.toHaveBeenCalled();
  });

  it("refuses a month on a course that is not billed monthly", async () => {
    const res = await logAdminPaymentAction(
      initial,
      form({ amount: "1000", periodMonth: "2026-09" }),
    );
    expect(res.error).toBe("This course is not billed monthly.");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("revalidates the student page and the payment surfaces", async () => {
    await logAdminPaymentAction(initial, form({ amount: "1000" }));
    expect(revalidatePath).toHaveBeenCalledWith("/admin/students/u1");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/payments/monthly");
    expect(revalidatePath).toHaveBeenCalledWith("/student/dashboard");
  });

  describe("on a monthly course", () => {
    beforeEach(() => {
      vi.mocked(db.enrollment.findUnique).mockResolvedValue(
        enrollmentRow({ course: { paymentFrequency: "MONTHLY" } }) as never,
      );
      tx.enrollment.findUnique.mockResolvedValue(lockedRow({ totalDue: null }));
    });

    it("requires the month the payment covers", async () => {
      const res = await logAdminPaymentAction(initial, form({ amount: "1000" }));
      expect(res.error).toBe("Select which month this payment covers.");
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("refuses a month outside the enrollment's range", async () => {
      const res = await logAdminPaymentAction(
        initial,
        form({ amount: "1000", periodMonth: "2026-07" }),
      );
      expect(res.error).toBe("That month is outside this enrollment's range.");
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    // One look-ahead month is payable, as on the student's own form.
    it("files the payment against the chosen month, including next month", async () => {
      const res = await logAdminPaymentAction(
        initial,
        form({ amount: "1000", periodMonth: "2026-11" }),
      );
      expect(res.error).toBeNull();
      expect(tx.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          periodMonth: new Date("2026-11-01T00:00:00Z"),
        }),
      });
    });

    // A monthly course has no single total, so its status is never derived,
    // even on a legacy row that still carries a lifetime totalDue.
    it("never touches the enrollment's status", async () => {
      tx.enrollment.findUnique.mockResolvedValue(lockedRow());
      await logAdminPaymentAction(
        initial,
        form({ amount: "1000", periodMonth: "2026-10" }),
      );
      expect(tx.enrollment.update).not.toHaveBeenCalled();
    });
  });
});

describe("setTotalDueAction", () => {
  it("refuses anyone who is not an admin", async () => {
    vi.mocked(getSession).mockResolvedValue(null as never);
    const res = await setTotalDueAction(initial, form({ totalDue: "20000" }));
    expect(res.error).toBe("Unauthorized");
  });

  it("refuses a monthly course, which has no single total", async () => {
    vi.mocked(db.enrollment.findUnique).mockResolvedValue(
      enrollmentRow({ course: { paymentFrequency: "MONTHLY" } }) as never,
    );
    const res = await setTotalDueAction(initial, form({ totalDue: "20000" }));
    expect(res.error).toBe("A monthly course is tracked month by month, not by a total.");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  // No clearing back to untracked: that was agreed out of scope.
  it("refuses a blank or negative total", async () => {
    for (const totalDue of ["", "-1", "abc"]) {
      const res = await setTotalDueAction(initial, form({ totalDue }));
      expect(res.error).toBe("Total due must be zero or a positive number.");
    }
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a negative already-paid figure", async () => {
    const res = await setTotalDueAction(
      initial,
      form({ totalDue: "20000", alreadyPaid: "-5" }),
    );
    expect(res.error).toBe("Already paid must be zero or a positive number.");
  });

  it("refuses a removed enrollment", async () => {
    tx.enrollment.findUnique.mockResolvedValue(lockedRow({ removedAt: new Date() }));
    const res = await setTotalDueAction(initial, form({ totalDue: "20000" }));
    expect(res.error).toBe("This student is removed from the course.");
    expect(tx.enrollment.update).not.toHaveBeenCalled();
  });

  it("changes a tracked total and re-derives the status from it", async () => {
    const res = await setTotalDueAction(initial, form({ totalDue: "15000" }));
    expect(res.error).toBeNull();
    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { totalDue: 15000, paymentStatus: "FULLY_PAID" },
    });
  });

  // The checkout money is already in the ledger once a total exists, so a
  // crafted already-paid figure must not record it a second time.
  it("ignores already-paid on a tracked enrollment", async () => {
    await setTotalDueAction(initial, form({ totalDue: "20000", alreadyPaid: "5000" }));
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { totalDue: 20000, paymentStatus: "PARTIALLY_PAID" },
    });
  });

  describe("starting to track an untracked enrollment", () => {
    beforeEach(() => {
      tx.enrollment.findUnique.mockResolvedValue(
        lockedRow({ totalDue: null, payments: [] }),
      );
    });

    it("records the already-paid money as the checkout row", async () => {
      const res = await setTotalDueAction(
        initial,
        form({ totalDue: "20000", alreadyPaid: "20000" }),
      );
      expect(res.error).toBeNull();
      expect(tx.payment.create).toHaveBeenCalledWith({
        data: {
          enrollmentId: "e1",
          purchaseId: "pur1",
          amount: 20000,
          proofUrl: "proofs/pur1.jpg",
          status: "APPROVED",
          source: "CHECKOUT",
          reviewedById: "a1",
          reviewedAt: expect.any(Date),
        },
      });
      expect(tx.enrollment.update).toHaveBeenCalledWith({
        where: { id: "e1" },
        data: { totalDue: 20000, paymentStatus: "FULLY_PAID" },
      });
    });

    it("writes no ledger row for a blank or zero already-paid figure", async () => {
      for (const alreadyPaid of ["", "0"]) {
        await setTotalDueAction(initial, form({ totalDue: "20000", alreadyPaid }));
      }
      expect(tx.payment.create).not.toHaveBeenCalled();
      expect(tx.enrollment.update).toHaveBeenLastCalledWith({
        where: { id: "e1" },
        data: { totalDue: 20000, paymentStatus: "PARTIALLY_PAID" },
      });
    });

    // A cleared or yearly enrollment can be untracked while its checkout money
    // is already recorded. Writing it again would count it twice.
    it("does not record checkout money a second time", async () => {
      tx.enrollment.findUnique.mockResolvedValue(
        lockedRow({
          totalDue: null,
          payments: [{ amount: decimal(5000), source: "CHECKOUT" }],
        }),
      );
      await setTotalDueAction(initial, form({ totalDue: "20000", alreadyPaid: "5000" }));
      expect(tx.payment.create).not.toHaveBeenCalled();
    });

    // A later admin-logged payment is not checkout money, so it must not
    // suppress the catch-up.
    it("still records checkout money when only ADMIN rows exist", async () => {
      tx.enrollment.findUnique.mockResolvedValue(
        lockedRow({
          totalDue: null,
          payments: [{ amount: decimal(1000), source: "ADMIN" }],
        }),
      );
      await setTotalDueAction(initial, form({ totalDue: "20000", alreadyPaid: "5000" }));
      expect(tx.payment.create).toHaveBeenCalled();
      expect(tx.enrollment.update).toHaveBeenCalledWith({
        where: { id: "e1" },
        data: { totalDue: 20000, paymentStatus: "PARTIALLY_PAID" },
      });
    });
  });
});
