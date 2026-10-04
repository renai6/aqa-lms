import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    enrollment: { findUnique: vi.fn() },
    course: { findUnique: vi.fn() },
    batch: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { moveEnrollmentCourseAction } from "@/lib/enrollments/actions";

const initial = { error: null };

let tx: {
  $queryRaw: ReturnType<typeof vi.fn>;
  enrollment: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  certificate: { findUnique: ReturnType<typeof vi.fn> };
  payment: { updateMany: ReturnType<typeof vi.fn> };
};

function form(fields: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("enrollmentId", "eA");
  fd.set("courseId", "cB");
  fd.set("batchId", "bB");
  fd.set("totalDue", "12000");
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const courseA = { title: "Marhala 1", archivedAt: null, paymentFrequency: "ONE_TIME" };
const courseB = { title: "Marhala 2", archivedAt: null, paymentFrequency: "ONE_TIME" };

// tx.enrollment.findUnique answers two different lookups: the locked course A
// row (by id) and the student's course B row (by userId_courseId).
function txEnrollmentLookups(courseBRow: unknown) {
  tx.enrollment.findUnique.mockImplementation(
    ({ where }: { where: { id?: string } }) =>
      Promise.resolve(
        where.id === "eA"
          ? { removedAt: null, paymentStatus: "PARTIALLY_PAID" }
          : courseBRow,
      ),
  );
}

describe("moveEnrollmentCourseAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({ userId: "a1", role: "ADMIN" } as never);
    vi.mocked(db.enrollment.findUnique).mockResolvedValue({
      userId: "u1",
      courseId: "cA",
      removedAt: null,
    } as never);
    vi.mocked(db.course.findUnique).mockImplementation((({
      where,
    }: {
      where: { id: string };
    }) =>
      Promise.resolve(
        where.id === "cA" ? courseA : where.id === "cB" ? courseB : null,
      )) as never);
    vi.mocked(db.batch.findUnique).mockResolvedValue({ courseId: "cB" } as never);

    tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      enrollment: {
        findUnique: vi.fn(),
        create: vi.fn().mockResolvedValue({ id: "eB" }),
        update: vi.fn().mockResolvedValue({ id: "eB" }),
      },
      certificate: { findUnique: vi.fn().mockResolvedValue(null) },
      payment: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
    txEnrollmentLookups(null);
    vi.mocked(db.$transaction).mockImplementation(((
      cb: (t: unknown) => unknown,
    ) => cb(tx)) as unknown as typeof db.$transaction);
  });

  it("creates the course B enrollment, moves payments, and removes course A", async () => {
    const result = await moveEnrollmentCourseAction(initial, form());

    expect(result.error).toBeNull();
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.enrollment.create).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        courseId: "cB",
        batchId: "bB",
        totalDue: 12000,
        paymentStatus: "PARTIALLY_PAID",
      },
      select: { id: true },
    });
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { enrollmentId: "eA" },
      data: { enrollmentId: "eB" },
    });
    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id: "eA" },
      data: { removedAt: expect.any(Date), removedReason: "Moved to Marhala 2" },
    });
  });

  it("restores a removed course B enrollment instead of creating one", async () => {
    txEnrollmentLookups({ id: "eB-old", removedAt: new Date() });
    tx.enrollment.update.mockResolvedValue({ id: "eB-old" });

    const result = await moveEnrollmentCourseAction(initial, form());

    expect(result.error).toBeNull();
    expect(tx.enrollment.create).not.toHaveBeenCalled();
    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id: "eB-old" },
      data: {
        batchId: "bB",
        totalDue: 12000,
        paymentStatus: "PARTIALLY_PAID",
        removedAt: null,
        removedReason: null,
      },
      select: { id: true },
    });
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { enrollmentId: "eA" },
      data: { enrollmentId: "eB-old" },
    });
  });

  it("stores a blank total as untracked", async () => {
    await moveEnrollmentCourseAction(initial, form({ totalDue: "  " }));

    expect(tx.enrollment.create.mock.calls[0][0].data.totalDue).toBeNull();
  });

  it("ignores totalDue for a monthly course", async () => {
    courseA.paymentFrequency = "MONTHLY";
    courseB.paymentFrequency = "MONTHLY";
    try {
      await moveEnrollmentCourseAction(initial, form({ totalDue: "5000" }));
      expect(tx.enrollment.create.mock.calls[0][0].data.totalDue).toBeNull();
    } finally {
      courseA.paymentFrequency = "ONE_TIME";
      courseB.paymentFrequency = "ONE_TIME";
    }
  });

  it("revalidates both courses and both batches lists", async () => {
    await moveEnrollmentCourseAction(initial, form());

    for (const path of [
      "/admin/students/u1",
      "/admin/courses/cA",
      "/admin/courses/cB",
      "/admin/courses/cA/batches",
      "/admin/courses/cB/batches",
    ])
      expect(revalidatePath).toHaveBeenCalledWith(path);
  });

  describe("refusals", () => {
    async function expectRefused(fields: Record<string, string>, error: string) {
      const result = await moveEnrollmentCourseAction(initial, form(fields));
      expect(result.error).toBe(error);
      expect(tx.enrollment.create).not.toHaveBeenCalled();
      expect(tx.payment.updateMany).not.toHaveBeenCalled();
    }

    it("rejects a non-admin", async () => {
      vi.mocked(getSession).mockResolvedValue({ userId: "t1", role: "TEACHER" } as never);
      await expectRefused({}, "Forbidden");
    });

    it("rejects a removed course A enrollment", async () => {
      vi.mocked(db.enrollment.findUnique).mockResolvedValue({
        userId: "u1",
        courseId: "cA",
        removedAt: new Date(),
      } as never);
      await expectRefused({}, "This student is already removed from the course.");
    });

    it("rejects moving into the same course", async () => {
      await expectRefused({ courseId: "cA" }, "Choose a different course.");
    });

    it("rejects an unknown course", async () => {
      await expectRefused({ courseId: "cX" }, "Course not found.");
    });

    it("rejects an archived course", async () => {
      vi.mocked(db.course.findUnique).mockImplementation((({
        where,
      }: {
        where: { id: string };
      }) =>
        Promise.resolve(
          where.id === "cA" ? courseA : { ...courseB, archivedAt: new Date() },
        )) as never);
      await expectRefused({}, "That course is archived.");
    });

    it("rejects courses that are billed differently", async () => {
      vi.mocked(db.course.findUnique).mockImplementation((({
        where,
      }: {
        where: { id: string };
      }) =>
        Promise.resolve(
          where.id === "cA" ? courseA : { ...courseB, paymentFrequency: null },
        )) as never);
      await expectRefused(
        {},
        "These courses are billed differently, so payments cannot move between them.",
      );
    });

    it("rejects a missing batch", async () => {
      vi.mocked(db.batch.findUnique).mockResolvedValue(null as never);
      await expectRefused({}, "Batch not found.");
    });

    it("rejects a batch from another course", async () => {
      vi.mocked(db.batch.findUnique).mockResolvedValue({ courseId: "cA" } as never);
      await expectRefused({}, "That batch belongs to a different course.");
    });

    it("rejects a negative or non-numeric total", async () => {
      await expectRefused({ totalDue: "-1" }, "Total due must be zero or a positive number.");
      await expectRefused({ totalDue: "abc" }, "Total due must be zero or a positive number.");
    });

    // Re-checked inside the locked transaction, so a certificate issued after
    // the dialog opened still blocks the move.
    it("refuses when a certificate exists", async () => {
      tx.certificate.findUnique.mockResolvedValue({ id: "cert1" });
      await expectRefused(
        {},
        "A certificate has been issued for this course, so the student can no longer be moved.",
      );
      expect(tx.enrollment.update).not.toHaveBeenCalled();
    });

    it("refuses when already actively enrolled in course B", async () => {
      txEnrollmentLookups({ id: "eB", removedAt: null });
      await expectRefused({}, "This student is already enrolled in Marhala 2.");
      expect(tx.enrollment.update).not.toHaveBeenCalled();
    });

    it("refuses when course A was removed after the first read", async () => {
      tx.enrollment.findUnique.mockImplementation(
        ({ where }: { where: { id?: string } }) =>
          Promise.resolve(
            where.id === "eA"
              ? { removedAt: new Date(), paymentStatus: "PARTIALLY_PAID" }
              : null,
          ),
      );
      await expectRefused({}, "This student is already removed from the course.");
    });
  });
});
