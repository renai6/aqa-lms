import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    course: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import {
  getPublishedCourses,
  getCourses,
  getCourseById,
} from "@/lib/courses/queries";

describe("course queries exclude archived courses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.course.findMany).mockResolvedValue([] as never);
    vi.mocked(db.course.findUnique).mockResolvedValue(null as never);
  });

  it("getPublishedCourses filters archivedAt: null", async () => {
    await getPublishedCourses();
    const arg = vi.mocked(db.course.findMany).mock.calls[0][0]!;
    expect(arg.where).toMatchObject({ isPublished: true, archivedAt: null });
  });

  it("getCourses filters archivedAt: null by default", async () => {
    await getCourses();
    const arg = vi.mocked(db.course.findMany).mock.calls[0][0]!;
    expect(arg.where).toEqual({ archivedAt: null });
  });

  it("getCourses(true) returns only archived courses", async () => {
    await getCourses(true);
    const arg = vi.mocked(db.course.findMany).mock.calls[0][0]!;
    expect(arg.where).toEqual({ archivedAt: { not: null } });
  });

  it("getCourseById filters archivedAt: null", async () => {
    await getCourseById("c1");
    const arg = vi.mocked(db.course.findUnique).mock.calls[0][0];
    expect(arg.where).toMatchObject({ id: "c1", archivedAt: null });
  });
});
