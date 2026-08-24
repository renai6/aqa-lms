import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    payment: { findMany: vi.fn(), groupBy: vi.fn(), findUnique: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import {
  getAdminPaymentsByStatus,
  getPaymentStatusCounts,
  getAdminPaymentById,
} from "@/lib/payments/queries";

describe("admin payment queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.payment.findMany).mockResolvedValue([] as never);
    vi.mocked(db.payment.groupBy).mockResolvedValue([] as never);
    vi.mocked(db.payment.findUnique).mockResolvedValue(null as never);
  });

  // Checkout rows are money already accounted for, not submissions awaiting a
  // decision. A queue that lists them asks the admin to review their own work.
  it("lists only student-submitted payments", async () => {
    await getAdminPaymentsByStatus("APPROVED");
    expect(db.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "APPROVED", source: "SUBMITTED" },
      }),
    );
  });

  it("counts only student-submitted payments, so tabs match their rows", async () => {
    await getPaymentStatusCounts();
    expect(db.payment.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { source: "SUBMITTED" } }),
    );
  });

  it("returns each row's enrollment balance", async () => {
    vi.mocked(db.payment.findMany).mockResolvedValue([
      {
        id: "pay1",
        status: "PENDING",
        amount: { toNumber: () => 5000 },
        createdAt: new Date(),
        enrollment: {
          totalDue: { toNumber: () => 20000 },
          payments: [{ amount: { toNumber: () => 3000 } }],
          user: { firstName: "Sam", lastName: "Lee", email: "s@example.com" },
          course: { title: "Marhala 1" },
        },
      },
    ] as never);

    const rows = await getAdminPaymentsByStatus("PENDING");
    expect(rows[0].balance).toEqual({
      kind: "tracked",
      totalDue: 20000,
      paid: 3000,
      remaining: 17000,
    });
  });

  it("reports an untracked balance when no total is set", async () => {
    vi.mocked(db.payment.findMany).mockResolvedValue([
      {
        id: "pay1",
        status: "PENDING",
        amount: { toNumber: () => 5000 },
        createdAt: new Date(),
        enrollment: {
          totalDue: null,
          payments: [],
          user: { firstName: "Sam", lastName: "Lee", email: "s@example.com" },
          course: { title: "Marhala 1" },
        },
      },
    ] as never);

    const rows = await getAdminPaymentsByStatus("PENDING");
    expect(rows[0].balance).toEqual({ kind: "untracked" });
  });

  // Guards the single invariant the whole feature rests on: deleting
  // `where: { status: "APPROVED" }` from the nested payments select would
  // let pending/rejected rows inflate the balance, and no test asserting
  // only the top-level `where` would catch it.
  it("selects only APPROVED payments for the enrollment balance", async () => {
    await getAdminPaymentsByStatus("APPROVED");
    const call = vi.mocked(db.payment.findMany).mock.calls[0]![0] as {
      select: { enrollment: { select: { payments: { where: unknown } } } };
    };
    expect(call.select.enrollment.select.payments.where).toEqual({
      status: "APPROVED",
    });
  });

  // The queue keeps a CHECKOUT row out by filtering on `source` alone. A
  // purchaseId-based filter was the tempting shortcut the design doc warns
  // against, and it would wrongly admit a CHECKOUT row that happens to carry
  // no purchaseId (an enrollment with no originating purchase).
  it("excludes a CHECKOUT row with no purchaseId by the source filter alone", async () => {
    await getAdminPaymentsByStatus("PENDING");
    const call = vi.mocked(db.payment.findMany).mock.calls[0]![0] as {
      where: Record<string, unknown>;
    };
    expect(call.where).toEqual({ status: "PENDING", source: "SUBMITTED" });
    expect(call.where).not.toHaveProperty("purchaseId");
  });
});

describe("getAdminPaymentById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.payment.findUnique).mockResolvedValue(null as never);
  });

  function baseRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "pay1",
      status: "PENDING",
      amount: { toNumber: () => 5000 },
      adminRemarks: null,
      createdAt: new Date(),
      enrollment: {
        paymentStatus: "PARTIALLY_PAID",
        totalDue: null,
        payments: [],
        user: {
          firstName: "Sam",
          lastName: "Lee",
          email: "s@example.com",
          contactNumber: null,
        },
        course: {
          id: "c1",
          title: "Marhala 1",
          tuitionFee: { toNumber: () => 20000 },
          paymentFrequency: "ONE_TIME",
        },
        purchase: null,
        ...overrides,
      },
    };
  }

  // Same invariant as the queue, on the other query that computes a balance.
  it("selects only APPROVED payments for the enrollment balance", async () => {
    vi.mocked(db.payment.findUnique).mockResolvedValue(baseRow() as never);
    await getAdminPaymentById("pay1");
    const call = vi.mocked(db.payment.findUnique).mock.calls[0]![0] as {
      select: { enrollment: { select: { payments: { where: unknown } } } };
    };
    expect(call.select.enrollment.select.payments.where).toEqual({
      status: "APPROVED",
    });
  });

  it("offers the already-paid catch-up field when no CHECKOUT payment exists yet", async () => {
    vi.mocked(db.payment.findUnique).mockResolvedValue(baseRow() as never);
    const result = await getAdminPaymentById("pay1");
    expect(result!.catchUpPrefill).toEqual({
      totalDue: "20000",
      alreadyPaid: "",
    });
  });

  // Finding 1: the enrollment can already have an APPROVED CHECKOUT payment
  // (recorded at purchase approval) while totalDue is still null - a
  // MONTHLY/YEARLY course, or one an admin cleared. Prefilling alreadyPaid
  // here would let the admin write a second CHECKOUT row for the same money.
  it("does not offer the already-paid field when a CHECKOUT payment already exists", async () => {
    vi.mocked(db.payment.findUnique).mockResolvedValue(
      baseRow({
        payments: [{ amount: { toNumber: () => 8000 }, source: "CHECKOUT" }],
      }) as never,
    );
    const result = await getAdminPaymentById("pay1");
    expect(result!.catchUpPrefill).toEqual({
      totalDue: "20000",
      alreadyPaid: null,
    });
  });

  // A legacy enrollment may already have APPROVED SUBMITTED payments from
  // the earlier additional-payments feature while its checkout money is
  // still missing from the ledger. Catch-up is still correct there.
  it("still offers already-paid when only SUBMITTED payments exist", async () => {
    vi.mocked(db.payment.findUnique).mockResolvedValue(
      baseRow({
        payments: [{ amount: { toNumber: () => 3000 }, source: "SUBMITTED" }],
      }) as never,
    );
    const result = await getAdminPaymentById("pay1");
    expect(result!.catchUpPrefill).toEqual({
      totalDue: "20000",
      alreadyPaid: "",
    });
  });

  it("offers no catch-up prefill once totalDue is set", async () => {
    vi.mocked(db.payment.findUnique).mockResolvedValue(
      baseRow({ totalDue: { toNumber: () => 20000 } }) as never,
    );
    const result = await getAdminPaymentById("pay1");
    expect(result!.catchUpPrefill).toBeNull();
  });
});
