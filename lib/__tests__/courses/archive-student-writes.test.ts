import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    assessment: { findFirst: vi.fn() },
    assessmentAttempt: { findFirst: vi.fn(), create: vi.fn() },
    studentAnswer: { createMany: vi.fn() },
    enrollment: { findUnique: vi.fn() },
    lesson: { findFirst: vi.fn() },
    lessonCompletion: { upsert: vi.fn(), deleteMany: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import {
  startAttemptAction,
  submitAttemptAction,
} from "@/app/(student)/student/courses/[id]/subjects/[sid]/assessments/actions";
import {
  markLessonDoneAction,
  unmarkLessonDoneAction,
} from "@/app/(student)/student/courses/[id]/subjects/[sid]/actions";

function form(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

// A stale student page can still POST after a course is archived. Each of
// these actions must fail closed instead of writing student progress against
// an archived course.
describe("student write actions block archived courses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      userId: "student1",
      role: "STUDENT",
    } as never);
    // These actions gate on isActiveStudent() before the archive check, so the
    // student has to look active for the archive behaviour to be reachable.
    vi.mocked(db.user.findUnique).mockResolvedValue({ isActive: true } as never);
  });

  it("startAttemptAction filters the assessment lookup by an active course and fails closed", async () => {
    vi.mocked(db.assessment.findFirst).mockResolvedValue(null as never);

    const result = await startAttemptAction(
      { error: null },
      form({ assessmentId: "a1", courseId: "c1", subjectId: "s1" }),
    );

    expect(result.error).toBe("Assessment is not available.");
    const arg = vi.mocked(db.assessment.findFirst).mock.calls[0][0]!;
    expect(arg.where).toMatchObject({ subject: { course: { archivedAt: null } } });
    expect(db.assessmentAttempt.create).not.toHaveBeenCalled();
  });

  it("submitAttemptAction filters the attempt lookup by an active course and fails closed", async () => {
    vi.mocked(db.assessmentAttempt.findFirst).mockResolvedValue(null as never);

    const result = await submitAttemptAction(
      { error: null },
      form({ attemptId: "att1" }),
    );

    expect(result.error).toBe("Attempt not found.");
    const arg = vi.mocked(db.assessmentAttempt.findFirst).mock.calls[0][0]!;
    expect(arg.where).toMatchObject({
      assessment: { subject: { course: { archivedAt: null } } },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("markLessonDoneAction filters the enrollment lookup by an active course and fails closed", async () => {
    vi.mocked(db.enrollment.findUnique).mockResolvedValue(null as never);

    const result = await markLessonDoneAction(
      { error: null },
      form({ lessonId: "l1", courseId: "c1", subjectId: "s1" }),
    );

    expect(result.error).toBe("Not enrolled in this course.");
    const arg = vi.mocked(db.enrollment.findUnique).mock.calls[0][0]!;
    expect(arg.where).toMatchObject({ course: { archivedAt: null } });
    expect(db.lessonCompletion.upsert).not.toHaveBeenCalled();
  });

  it("unmarkLessonDoneAction filters the enrollment lookup by an active course and fails closed", async () => {
    vi.mocked(db.enrollment.findUnique).mockResolvedValue(null as never);

    const result = await unmarkLessonDoneAction(
      { error: null },
      form({ lessonId: "l1", courseId: "c1", subjectId: "s1" }),
    );

    expect(result.error).toBe("Not enrolled in this course.");
    const arg = vi.mocked(db.enrollment.findUnique).mock.calls[0][0]!;
    expect(arg.where).toMatchObject({ course: { archivedAt: null } });
    expect(db.lessonCompletion.deleteMany).not.toHaveBeenCalled();
  });
});
