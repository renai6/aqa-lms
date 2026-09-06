import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { user: { findUnique: vi.fn(), findMany: vi.fn() } },
}));

import { db } from "@/lib/db";
import { getAllStudents, getStudentById } from "@/lib/students/queries";

const enrollmentRow = {
  id: "e1",
  courseId: "c1",
  enrolledAt: new Date("2026-01-05"),
  completedAt: null,
  progress: 40,
  paymentStatus: "PARTIALLY_PAID",
  removedAt: new Date("2026-08-01"),
  removedReason: "Transferred to Marhala 2",
  course: { title: "Marhala 1" },
};

// Removal is an admin correction, so admins keep seeing the row - badged and
// restorable. Both admin surfaces therefore need the removal details, and the
// enrollment id the remove/restore actions key on.
describe("admin student queries expose removed enrollments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getAllStudents carries the enrollment id and removedAt through", async () => {
    vi.mocked(db.user.findMany).mockResolvedValue([
      {
        id: "s1",
        firstName: "Sam",
        lastName: "Ali",
        email: "s@example.com",
        gender: "MALE",
        isActive: true,
        createdAt: new Date("2026-01-01"),
        contactNumber: null,
        facebookName: null,
        facebookLink: null,
        enrollments: [enrollmentRow],
      },
    ] as never);

    const [student] = await getAllStudents({ courseId: "c1" });

    expect(student.enrollments[0]).toMatchObject({
      id: "e1",
      courseId: "c1",
      courseTitle: "Marhala 1",
      removedAt: enrollmentRow.removedAt,
    });
  });

  it("getStudentById carries the removal reason through", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "s1",
      firstName: "Sam",
      lastName: "Ali",
      email: "s@example.com",
      gender: "MALE",
      isActive: true,
      createdAt: new Date("2026-01-01"),
      role: "STUDENT",
      enrollments: [enrollmentRow],
    } as never);

    const student = await getStudentById("s1");

    expect(student!.enrollments[0]).toMatchObject({
      id: "e1",
      removedAt: enrollmentRow.removedAt,
      removedReason: "Transferred to Marhala 2",
    });
  });
});
