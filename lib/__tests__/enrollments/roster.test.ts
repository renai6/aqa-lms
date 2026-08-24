import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { enrollment: { findMany: vi.fn() } },
}));

import { db } from "@/lib/db";
import { getCourseRoster } from "@/lib/students/queries";

describe("getCourseRoster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.enrollment.findMany).mockResolvedValue([] as never);
  });

  it("scopes to the course and keeps removed rows for the admin", async () => {
    await getCourseRoster("c1");
    const arg = vi.mocked(db.enrollment.findMany).mock.calls[0][0]!;
    expect(arg.where).toEqual({ courseId: "c1" });
  });

  it("flattens each enrollment into a roster row", async () => {
    vi.mocked(db.enrollment.findMany).mockResolvedValue([
      {
        id: "e1",
        enrolledAt: new Date("2026-01-05"),
        removedAt: null,
        removedReason: null,
        paymentStatus: "FULLY_PAID",
        user: {
          id: "s1",
          firstName: "Sam",
          lastName: "Ali",
          email: "s@example.com",
        },
      },
    ] as never);

    expect(await getCourseRoster("c1")).toEqual([
      {
        enrollmentId: "e1",
        studentId: "s1",
        firstName: "Sam",
        lastName: "Ali",
        email: "s@example.com",
        enrolledAt: new Date("2026-01-05"),
        paymentStatus: "FULLY_PAID",
        removedAt: null,
        removedReason: null,
      },
    ]);
  });

  it("orders active students ahead of removed ones", async () => {
    await getCourseRoster("c1");
    const arg = vi.mocked(db.enrollment.findMany).mock.calls[0][0]!;
    expect(arg.orderBy).toEqual([
      { removedAt: { sort: "asc", nulls: "first" } },
      { user: { lastName: "asc" } },
    ]);
  });
});
