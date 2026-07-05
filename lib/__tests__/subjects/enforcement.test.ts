import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    subject: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    enrollment: { findUnique: vi.fn() },
    lessonCompletion: { findMany: vi.fn() },
    batchLessonContent: { findMany: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { getStudentSubject } from "@/lib/student/queries";

const femaleSubject = {
  id: "sub1",
  courseId: "course1",
  title: "Sisters Fiqh",
  description: null,
  gender: "FEMALE",
  course: { title: "Islamic Studies" },
  schedules: [],
  lessons: [],
  assessments: [],
};

describe("getStudentSubject gender enforcement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks a male student from a female-only subject (returns null)", async () => {
    vi.mocked(db.subject.findUnique).mockResolvedValue(femaleSubject as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      gender: "MALE",
    } as never);

    const result = await getStudentSubject("user-male", "sub1");

    expect(result).toBeNull();
    // Must fail before checking enrollment — the wall is gender, not enrollment.
    expect(db.enrollment.findUnique).not.toHaveBeenCalled();
  });

  it("blocks a null-gender student from a restricted subject (fail-closed)", async () => {
    vi.mocked(db.subject.findUnique).mockResolvedValue(femaleSubject as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({ gender: null } as never);

    const result = await getStudentSubject("user-unknown", "sub1");

    expect(result).toBeNull();
    expect(db.enrollment.findUnique).not.toHaveBeenCalled();
  });

  it("allows a female student into a female-only subject", async () => {
    vi.mocked(db.subject.findUnique).mockResolvedValue(femaleSubject as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      gender: "FEMALE",
    } as never);
    vi.mocked(db.enrollment.findUnique).mockResolvedValue({
      id: "enr1",
      batchId: null,
    } as never);
    vi.mocked(db.lessonCompletion.findMany).mockResolvedValue([] as never);
    vi.mocked(db.batchLessonContent.findMany).mockResolvedValue([] as never);

    const result = await getStudentSubject("user-female", "sub1");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("sub1");
    expect(db.enrollment.findUnique).toHaveBeenCalled();
  });
});
