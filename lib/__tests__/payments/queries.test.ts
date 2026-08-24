import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { payment: { findMany: vi.fn(), groupBy: vi.fn() } },
}));

import { db } from "@/lib/db";
import {
  getAdminPaymentsByStatus,
  getPaymentStatusCounts,
} from "@/lib/payments/queries";

describe("admin payment queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.payment.findMany).mockResolvedValue([] as never);
    vi.mocked(db.payment.groupBy).mockResolvedValue([] as never);
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
});
