import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    enrollment: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import {
  removeEnrollmentAction,
  restoreEnrollmentAction,
} from "@/lib/enrollments/actions";

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

const initial = { error: null };

const enrolled = {
  userId: "s1",
  courseId: "c1",
  removedAt: null,
};

describe("removeEnrollmentAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an unauthenticated caller", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const result = await removeEnrollmentAction(
      initial,
      form({ enrollmentId: "e1" }),
    );
    expect(result.error).toBe("Unauthorized");
    expect(db.enrollment.update).not.toHaveBeenCalled();
  });

  it("rejects a TEACHER caller", async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: "t1", role: "TEACHER" });
    const result = await removeEnrollmentAction(
      initial,
      form({ enrollmentId: "e1" }),
    );
    expect(result.error).toBe("Forbidden");
    expect(db.enrollment.update).not.toHaveBeenCalled();
  });

  it("rejects a STUDENT caller", async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: "s9", role: "STUDENT" });
    const result = await removeEnrollmentAction(
      initial,
      form({ enrollmentId: "e1" }),
    );
    expect(result.error).toBe("Forbidden");
    expect(db.enrollment.update).not.toHaveBeenCalled();
  });

  it("rejects a missing enrollment id", async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: "a1", role: "ADMIN" });
    const result = await removeEnrollmentAction(initial, new FormData());
    expect(result.error).toBe("Invalid enrollment ID.");
    expect(db.enrollment.update).not.toHaveBeenCalled();
  });

  it("returns not found for an unknown enrollment", async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: "a1", role: "ADMIN" });
    vi.mocked(db.enrollment.findUnique).mockResolvedValue(null as never);
    const result = await removeEnrollmentAction(
      initial,
      form({ enrollmentId: "ghost" }),
    );
    expect(result.error).toBe("Enrollment not found.");
    expect(db.enrollment.update).not.toHaveBeenCalled();
  });

  it("refuses to remove an enrollment that is already removed", async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: "a1", role: "ADMIN" });
    vi.mocked(db.enrollment.findUnique).mockResolvedValue({
      ...enrolled,
      removedAt: new Date("2026-08-01"),
    } as never);
    const result = await removeEnrollmentAction(
      initial,
      form({ enrollmentId: "e1" }),
    );
    expect(result.error).toBe(
      "This student is already removed from the course.",
    );
    expect(db.enrollment.update).not.toHaveBeenCalled();
  });

  it("stamps removedAt and the reason, and revalidates every surface", async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: "a1", role: "ADMIN" });
    vi.mocked(db.enrollment.findUnique).mockResolvedValue(enrolled as never);

    const result = await removeEnrollmentAction(
      initial,
      form({ enrollmentId: "e1", reason: "  Transferred to Marhala 2  " }),
    );

    expect(result.error).toBeNull();
    expect(db.enrollment.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: {
        removedAt: expect.any(Date),
        removedReason: "Transferred to Marhala 2",
      },
    });
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/admin/students");
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(
      "/admin/students/s1",
    );
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/admin/courses/c1");
  });

  it("stores a blank reason as null", async () => {
    vi.mocked(getSession).mockResolvedValue({
      userId: "a1",
      role: "SUPER_ADMIN",
    });
    vi.mocked(db.enrollment.findUnique).mockResolvedValue(enrolled as never);

    await removeEnrollmentAction(
      initial,
      form({ enrollmentId: "e1", reason: "   " }),
    );

    expect(db.enrollment.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { removedAt: expect.any(Date), removedReason: null },
    });
  });

  it("reports a database failure without revalidating", async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: "a1", role: "ADMIN" });
    vi.mocked(db.enrollment.findUnique).mockResolvedValue(enrolled as never);
    vi.mocked(db.enrollment.update).mockRejectedValueOnce(
      new Error("boom") as never,
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await removeEnrollmentAction(
      initial,
      form({ enrollmentId: "e1" }),
    );

    expect(result.error).toBe("A database error occurred. Please try again.");
    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("restoreEnrollmentAction", () => {
  beforeEach(() => vi.clearAllMocks());

  const removed = {
    userId: "s1",
    courseId: "c1",
    removedAt: new Date("2026-08-01"),
  };

  it("rejects a STUDENT caller", async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: "s9", role: "STUDENT" });
    const result = await restoreEnrollmentAction(
      initial,
      form({ enrollmentId: "e1" }),
    );
    expect(result.error).toBe("Forbidden");
    expect(db.enrollment.update).not.toHaveBeenCalled();
  });

  it("returns not found for an unknown enrollment", async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: "a1", role: "ADMIN" });
    vi.mocked(db.enrollment.findUnique).mockResolvedValue(null as never);
    const result = await restoreEnrollmentAction(
      initial,
      form({ enrollmentId: "ghost" }),
    );
    expect(result.error).toBe("Enrollment not found.");
    expect(db.enrollment.update).not.toHaveBeenCalled();
  });

  it("refuses to restore an enrollment that was never removed", async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: "a1", role: "ADMIN" });
    vi.mocked(db.enrollment.findUnique).mockResolvedValue(enrolled as never);
    const result = await restoreEnrollmentAction(
      initial,
      form({ enrollmentId: "e1" }),
    );
    expect(result.error).toBe("This student is not removed from the course.");
    expect(db.enrollment.update).not.toHaveBeenCalled();
  });

  it("clears removedAt and the reason together", async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: "a1", role: "ADMIN" });
    vi.mocked(db.enrollment.findUnique).mockResolvedValue(removed as never);

    const result = await restoreEnrollmentAction(
      initial,
      form({ enrollmentId: "e1" }),
    );

    expect(result.error).toBeNull();
    expect(db.enrollment.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { removedAt: null, removedReason: null },
    });
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(
      "/admin/students/s1",
    );
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/admin/courses/c1");
  });
});
