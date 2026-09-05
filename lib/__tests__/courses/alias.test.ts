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

function form(courseAlias: string) {
  const f = new FormData();
  f.set("id", "c1");
  f.set("title", "Marhala 1");
  f.set("description", "");
  f.set("courseType", "ON_SITE");
  f.set("passingGrade", "75");
  f.set("courseAlias", courseAlias);
  return f;
}

const savedAlias = () =>
  vi.mocked(db.course.update).mock.calls[0][0].data.courseAlias;

describe("course alias", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({ role: "ADMIN" } as never);
    vi.mocked(db.course.update).mockResolvedValue({} as never);
  });

  // The alias is a code that gets concatenated straight into a batch name, so
  // stray case or padding would show up verbatim in "0926 mm01 ".
  it("stores the alias uppercased and trimmed", async () => {
    await updateCourseAction({ error: null }, form("  mm01 "));
    expect(savedAlias()).toBe("MM01");
  });

  it("stores null when the alias is left blank", async () => {
    await updateCourseAction({ error: null }, form("   "));
    expect(savedAlias()).toBeNull();
  });

  it("rejects an alias that is too long to read in a batch name", async () => {
    const result = await updateCourseAction({ error: null }, form("A".repeat(21)));
    expect(result.error).toBe("Course alias is too long.");
    expect(db.course.update).not.toHaveBeenCalled();
  });
});
