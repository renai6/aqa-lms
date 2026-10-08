import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { course: { update: vi.fn() } },
}));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: {} }));

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { updateCourseAction } from "@/app/(admin)/admin/courses/actions";

function form(courseStatus: string) {
  const f = new FormData();
  f.set("id", "c1");
  f.set("title", "Marhala 1");
  f.set("description", "");
  f.set("courseType", "ON_SITE");
  f.set("passingGrade", "75");
  f.set("courseStatus", courseStatus);
  return f;
}

const savedStatus = () =>
  vi.mocked(db.course.update).mock.calls[0][0].data.courseStatus;

describe("course status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({ role: "ADMIN" } as never);
    vi.mocked(db.course.update).mockResolvedValue({} as never);
  });

  it("stores the selected status", async () => {
    await updateCourseAction({ error: null }, form("CLASSES_ONGOING"));
    expect(savedStatus()).toBe("CLASSES_ONGOING");
  });

  // "Not specified" submits an empty value, which clears the badge.
  it("stores null when no status is selected", async () => {
    await updateCourseAction({ error: null }, form(""));
    expect(savedStatus()).toBeNull();
  });

  it("rejects an unknown status", async () => {
    const result = await updateCourseAction({ error: null }, form("ARCHIVED"));
    expect(result.error).not.toBeNull();
    expect(db.course.update).not.toHaveBeenCalled();
  });
});
