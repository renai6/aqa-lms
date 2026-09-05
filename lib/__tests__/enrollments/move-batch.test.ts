import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    enrollment: { findUnique: vi.fn(), update: vi.fn() },
    batch: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { moveEnrollmentBatchAction } from "@/lib/enrollments/actions";

const initial = { error: null };

function form(fields: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("enrollmentId", "e1");
  fd.set("batchId", "b35");
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("moveEnrollmentBatchAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      userId: "a1",
      role: "ADMIN",
    } as never);
    vi.mocked(db.enrollment.findUnique).mockResolvedValue({
      userId: "u1",
      courseId: "c1",
      removedAt: null,
    } as never);
    vi.mocked(db.batch.findUnique).mockResolvedValue({
      courseId: "c1",
    } as never);
  });

  it("writes the new batch onto the enrollment", async () => {
    const result = await moveEnrollmentBatchAction(initial, form());

    expect(result.error).toBeNull();
    expect(db.enrollment.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { batchId: "b35" },
    });
  });

  // Batch.courseId is not constrained against Enrollment.courseId, so nothing
  // in the database stops an enrollment pointing at another course's batch -
  // the student would silently be served that course's lesson content.
  it("rejects a batch belonging to a different course", async () => {
    vi.mocked(db.batch.findUnique).mockResolvedValue({
      courseId: "c2",
    } as never);

    const result = await moveEnrollmentBatchAction(initial, form());

    expect(result.error).toBe("That batch belongs to a different course.");
    expect(db.enrollment.update).not.toHaveBeenCalled();
  });

  it("rejects a batch that does not exist", async () => {
    vi.mocked(db.batch.findUnique).mockResolvedValue(null as never);

    const result = await moveEnrollmentBatchAction(initial, form());

    expect(result.error).toBe("Batch not found.");
    expect(db.enrollment.update).not.toHaveBeenCalled();
  });

  // A removed student has no access to the course, so moving them between
  // batches is meaningless - and an approved repurchase would reassign the
  // batch anyway. Restore first.
  it("rejects a removed enrollment", async () => {
    vi.mocked(db.enrollment.findUnique).mockResolvedValue({
      userId: "u1",
      courseId: "c1",
      removedAt: new Date(),
    } as never);

    const result = await moveEnrollmentBatchAction(initial, form());

    expect(result.error).toBe(
      "Restore this student to the course before moving them to another batch.",
    );
    expect(db.enrollment.update).not.toHaveBeenCalled();
  });

  it("rejects a non-admin", async () => {
    vi.mocked(getSession).mockResolvedValue({
      userId: "t1",
      role: "TEACHER",
    } as never);

    const result = await moveEnrollmentBatchAction(initial, form());

    expect(result.error).toBe("Forbidden");
    expect(db.enrollment.update).not.toHaveBeenCalled();
  });

  // The batches list shows a per-batch enrollment count, which both the source
  // and the destination batch change.
  it("revalidates the batches list", async () => {
    await moveEnrollmentBatchAction(initial, form());

    expect(revalidatePath).toHaveBeenCalledWith("/admin/courses/c1/batches");
  });
});
