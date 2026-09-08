import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    course: { findMany: vi.fn(), findFirst: vi.fn() },
    enrollment: { findMany: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import {
  getMonthlyCourses,
  getCourseMonthlyMatrix,
} from "@/lib/payments/monthly-queries";

const decimal = (n: number) => ({ toNumber: () => n });

describe("getMonthlyCourses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.course.findMany).mockResolvedValue([] as never);
  });

  it("lists only monthly, non-archived courses", async () => {
    await getMonthlyCourses();
    expect(db.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { paymentFrequency: "MONTHLY", archivedAt: null },
      }),
    );
  });

  it("does not filter on isPublished", async () => {
    // An unpublished course can still have enrolled students who owe money.
    // Hiding it would hide their arrears.
    await getMonthlyCourses();
    const call = vi.mocked(db.course.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(call.where).not.toHaveProperty("isPublished");
  });
});

describe("getCourseMonthlyMatrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.course.findFirst).mockResolvedValue({
      id: "c1",
      title: "Marhala 1",
      tuitionFee: decimal(1500),
    } as never);
    vi.mocked(db.enrollment.findMany).mockResolvedValue([] as never);
  });

  it("returns null for a course that is not billed monthly", async () => {
    vi.mocked(db.course.findFirst).mockResolvedValue(null as never);
    expect(await getCourseMonthlyMatrix("c1")).toBeNull();
  });

  it("selects only approved and pending payments", async () => {
    // Rejected payments are not money received and are not awaiting review,
    // so they say nothing about a month.
    await getCourseMonthlyMatrix("c1");
    const call = vi.mocked(db.enrollment.findMany).mock.calls[0][0] as {
      select: { payments: { where: unknown } };
    };
    expect(call.select.payments.where).toEqual({
      status: { in: ["APPROVED", "PENDING"] },
    });
  });

  it("includes removed enrollments so their arrears stay visible", async () => {
    // Staff surfaces deliberately do not apply ACTIVE_ENROLLMENT: admins
    // still see removed rows so the history stays auditable.
    await getCourseMonthlyMatrix("c1");
    const call = vi.mocked(db.enrollment.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(call.where).toEqual({ courseId: "c1" });
  });

  it("converts stored period dates back into month keys", async () => {
    vi.mocked(db.enrollment.findMany).mockResolvedValue([
      {
        id: "e1",
        enrolledAt: new Date("2026-09-01T09:00:00+08:00"),
        completedAt: null,
        removedAt: null,
        user: { firstName: "Aisha", lastName: "R", email: "a@x.c" },
        payments: [
          {
            amount: decimal(1500),
            periodMonth: new Date("2026-09-01T00:00:00.000Z"),
            status: "APPROVED",
          },
        ],
      },
    ] as never);
    const result = await getCourseMonthlyMatrix(
      "c1",
      new Date("2026-09-08T10:00:00+08:00"),
    );
    const cell = result!.matrix.rows[0].cells[0];
    expect(cell.owed && cell.status).toEqual({ kind: "paid", paid: 1500 });
  });
});
