import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    course: { findUnique: vi.fn(), findMany: vi.fn() },
    enrollment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    subject: { findUnique: vi.fn() },
    assessment: { findUnique: vi.fn() },
    assessmentAttempt: { findUnique: vi.fn() },
    payment: { findMany: vi.fn() },
    purchaseItem: { findMany: vi.fn() },
    announcement: { findMany: vi.fn() },
    purchase: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    grade: { findMany: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import {
  getStudentDashboard,
  getStudentCourse,
  getStudentSubject,
} from "@/lib/student/queries";
import { getCertificateEligibility } from "@/lib/certificates/queries";
import {
  getEnrollmentForPayment,
  getEnrollmentBalances,
  getEnrollmentPaymentStates,
} from "@/lib/payments/queries";
import { getPurchasableCourses } from "@/lib/purchases/queries";
import { getSubjectStudents } from "@/lib/teacher/queries";

// A removed enrollment must vanish from every student-facing surface. Each of
// these is a separate read path, so each gets its own guard.
describe("student-facing queries exclude removed enrollments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue({
      gender: "MALE",
    } as never);
    vi.mocked(db.course.findUnique).mockResolvedValue(null as never);
    vi.mocked(db.course.findMany).mockResolvedValue([] as never);
    vi.mocked(db.subject.findUnique).mockResolvedValue(null as never);
    vi.mocked(db.enrollment.findUnique).mockResolvedValue(null as never);
    vi.mocked(db.enrollment.findFirst).mockResolvedValue(null as never);
    vi.mocked(db.enrollment.findMany).mockResolvedValue([] as never);
    vi.mocked(db.purchaseItem.findMany).mockResolvedValue([] as never);
    vi.mocked(db.announcement.findMany).mockResolvedValue([] as never);
    vi.mocked(db.purchase.findMany).mockResolvedValue([] as never);
    vi.mocked(db.payment.findMany).mockResolvedValue([] as never);
    vi.mocked(db.grade.findMany).mockResolvedValue([] as never);
  });

  it("getStudentDashboard filters removedAt: null", async () => {
    await getStudentDashboard("u1");
    const arg = vi.mocked(db.enrollment.findMany).mock.calls[0][0]!;
    expect(arg.where).toMatchObject({ userId: "u1", removedAt: null });
  });

  it("getStudentCourse filters removedAt: null", async () => {
    await getStudentCourse("u1", "c1");
    const arg = vi.mocked(db.enrollment.findUnique).mock.calls[0][0]!;
    expect(arg.where).toMatchObject({ removedAt: null });
  });

  it("getStudentSubject filters removedAt: null", async () => {
    vi.mocked(db.subject.findUnique).mockResolvedValue({
      id: "s1",
      courseId: "c1",
      gender: null,
      title: "Fiqh",
      description: null,
      lessons: [],
      course: { title: "Marhala 1", archivedAt: null },
    } as never);

    await getStudentSubject("u1", "s1");

    const arg = vi.mocked(db.enrollment.findUnique).mock.calls[0][0]!;
    expect(arg.where).toMatchObject({ removedAt: null });
  });

  // Full blackout: removal takes the certificate with it.
  it("getCertificateEligibility filters removedAt: null", async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue({
      id: "c1",
      passingGrade: 75,
      subjects: [],
    } as never);

    await getCertificateEligibility("u1", "c1");

    const arg = vi.mocked(db.enrollment.findUnique).mock.calls[0][0]!;
    expect(arg.where).toMatchObject({ removedAt: null });
  });

  it("getEnrollmentForPayment filters removedAt: null", async () => {
    await getEnrollmentForPayment("u1", "e1");
    const arg = vi.mocked(db.enrollment.findFirst).mock.calls[0][0]!;
    expect(arg.where).toMatchObject({
      id: "e1",
      userId: "u1",
      removedAt: null,
    });
  });

  it("getEnrollmentBalances filters removedAt: null", async () => {
    await getEnrollmentBalances("u1");
    const arg = vi.mocked(db.enrollment.findMany).mock.calls[0][0]!;
    expect(arg.where).toMatchObject({ userId: "u1", removedAt: null });
  });

  it("getEnrollmentPaymentStates filters removedAt: null", async () => {
    await getEnrollmentPaymentStates("u1");
    const arg = vi.mocked(db.payment.findMany).mock.calls[0][0]!;
    expect(arg.where).toMatchObject({
      enrollment: { userId: "u1", removedAt: null },
    });
  });

  // Removal has to free the course up again, otherwise the student can never
  // re-enroll: this query lists the courses already taken so the catalog can
  // hide them.
  it("getPurchasableCourses ignores removed enrollments when deciding what is already taken", async () => {
    await getPurchasableCourses("u1");
    const arg = vi.mocked(db.enrollment.findMany).mock.calls[0][0]!;
    expect(arg.where).toMatchObject({ userId: "u1", removedAt: null });
  });
});

// Teachers are staff, but a removed student genuinely is not in the class any
// more, so rosters and grade sheets drop them too.
describe("teacher rosters exclude removed enrollments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.enrollment.findMany).mockResolvedValue([] as never);
    vi.mocked(db.subject.findUnique).mockResolvedValue({
      courseId: "c1",
      gender: null,
    } as never);
  });

  it("getSubjectStudents filters removedAt: null", async () => {
    await getSubjectStudents("s1");
    const arg = vi.mocked(db.enrollment.findMany).mock.calls[0][0]!;
    expect(arg.where).toMatchObject({ courseId: "c1", removedAt: null });
  });
});

// Removing a student has to actually free the course up for re-purchase. An
// APPROVED purchase always produced an enrollment, so the enrollment check
// alone already covers it - keeping APPROVED in the purchase-item filter would
// mark the course taken forever, and the student could never buy it again.
describe("a removed student can buy the course again", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.course.findMany).mockResolvedValue([
      {
        id: "c1",
        title: "Arabic",
        tuitionFee: null,
        groupName: null,
        level: null,
      },
    ] as never);
    vi.mocked(db.enrollment.findMany).mockResolvedValue([] as never);
    vi.mocked(db.purchaseItem.findMany).mockResolvedValue([] as never);
  });

  it("only an in-flight PENDING purchase reserves a course", async () => {
    await getPurchasableCourses("u1");
    const arg = vi.mocked(db.purchaseItem.findMany).mock.calls[0][0]!;
    expect(arg.where).toMatchObject({
      purchase: { userId: "u1", status: "PENDING" },
    });
  });

  it("offers the course again once the enrollment is gone", async () => {
    const courses = await getPurchasableCourses("u1");
    expect(courses.map((c) => c.id)).toContain("c1");
  });
});
