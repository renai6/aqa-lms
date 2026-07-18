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
import {
  archiveCourseAction,
  restoreCourseAction,
} from "@/app/(admin)/admin/courses/actions";

function form(id: string) {
  const f = new FormData();
  f.set("id", id);
  return f;
}

describe("archiveCourseAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({ role: "ADMIN" } as never);
  });

  // The original bug: a course with enrollments and purchase items could not
  // be removed at all, because deleting it violated PurchaseItem_courseId_fkey.
  // Archiving only writes a timestamp, so no foreign key is ever touched.
  it("archives a course by setting archivedAt without deleting any rows", async () => {
    vi.mocked(db.course.update).mockResolvedValue({} as never);

    await expect(archiveCourseAction({ error: null }, form("c1"))).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(db.course.update).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(db.course.update).mock.calls[0][0];
    expect(arg.where).toEqual({ id: "c1" });
    expect(arg.data.archivedAt).toBeInstanceOf(Date);
  });

  it("rejects a non-admin", async () => {
    vi.mocked(getSession).mockResolvedValue({ role: "STUDENT" } as never);
    const r = await archiveCourseAction({ error: null }, form("c1"));
    expect(r.error).toBe("Forbidden");
    expect(db.course.update).not.toHaveBeenCalled();
  });

  it("rejects a missing id", async () => {
    const r = await archiveCourseAction({ error: null }, new FormData());
    expect(r.error).toBe("Invalid course ID.");
    expect(db.course.update).not.toHaveBeenCalled();
  });
});

describe("restoreCourseAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({ role: "ADMIN" } as never);
  });

  it("clears archivedAt", async () => {
    vi.mocked(db.course.update).mockResolvedValue({} as never);

    const r = await restoreCourseAction({ error: null }, form("c1"));

    expect(r.error).toBeNull();
    expect(db.course.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { archivedAt: null },
    });
  });
});
