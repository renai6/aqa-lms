import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    course: { findUnique: vi.fn(), findMany: vi.fn() },
    enrollment: { findUnique: vi.fn(), findMany: vi.fn() },
    purchaseItem: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { getStudentCourse } from "@/lib/student/queries";
import { getCertificateEligibility } from "@/lib/certificates/queries";
import { getPurchasableCourses } from "@/lib/purchases/queries";

describe("student-facing queries exclude archived courses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue({ gender: "MALE" } as never);
    vi.mocked(db.course.findUnique).mockResolvedValue(null as never);
    vi.mocked(db.course.findMany).mockResolvedValue([] as never);
    vi.mocked(db.enrollment.findUnique).mockResolvedValue(null as never);
    vi.mocked(db.enrollment.findMany).mockResolvedValue([] as never);
    vi.mocked(db.purchaseItem.findMany).mockResolvedValue([] as never);
  });

  it("getStudentCourse filters archivedAt: null", async () => {
    await getStudentCourse("u1", "c1");
    const arg = vi.mocked(db.course.findUnique).mock.calls[0][0];
    expect(arg.where).toMatchObject({ id: "c1", archivedAt: null });
  });

  // Full blackout: an archived course takes its certificate with it.
  it("getCertificateEligibility filters archivedAt: null", async () => {
    await getCertificateEligibility("u1", "c1");
    const arg = vi.mocked(db.course.findUnique).mock.calls[0][0];
    expect(arg.where).toMatchObject({ id: "c1", archivedAt: null });
  });

  it("getPurchasableCourses filters archivedAt: null", async () => {
    await getPurchasableCourses("u1");
    const arg = vi.mocked(db.course.findMany).mock.calls[0][0]!;
    expect(arg.where).toMatchObject({ isPublished: true, archivedAt: null });
  });
});
