"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { isMovedAway, movedReason } from "@/lib/enrollments/moved";

type ActionState = { error: string | null };

// Removing a student from a course is reversible and destroys nothing. The
// Enrollment row stays, keeping its payments, grades, progress and certificate
// attached, so the academic and financial record survives an admin correction.
// The student simply stops seeing the course.

async function loadTarget(formData: FormData): Promise<
  | { error: string }
  | {
      id: string;
      enrollment: {
        userId: string;
        courseId: string;
        removedAt: Date | null;
        removedReason: string | null;
      };
    }
> {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };
  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")
    return { error: "Forbidden" };

  const id = formData.get("enrollmentId");
  if (typeof id !== "string" || !id) return { error: "Invalid enrollment ID." };

  const enrollment = await db.enrollment.findUnique({
    where: { id },
    select: {
      userId: true,
      courseId: true,
      removedAt: true,
      removedReason: true,
    },
  });
  if (!enrollment) return { error: "Enrollment not found." };

  return { id, enrollment };
}

function revalidateSurfaces(userId: string, courseId: string) {
  revalidatePath("/admin/students");
  revalidatePath("/admin/students/" + userId);
  revalidatePath("/admin/courses/" + courseId);
}

export async function removeEnrollmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const target = await loadTarget(formData);
  if ("error" in target) return { error: target.error };

  const { id, enrollment } = target;
  if (enrollment.removedAt)
    return { error: "This student is already removed from the course." };

  const rawReason = formData.get("reason");
  const reason = typeof rawReason === "string" ? rawReason.trim() : "";

  try {
    await db.enrollment.update({
      where: { id },
      data: { removedAt: new Date(), removedReason: reason || null },
    });
  } catch (err) {
    console.error("[removeEnrollment]", err);
    return { error: "A database error occurred. Please try again." };
  }

  revalidateSurfaces(enrollment.userId, enrollment.courseId);
  return { error: null };
}

export async function restoreEnrollmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const target = await loadTarget(formData);
  if ("error" in target) return { error: target.error };

  const { id, enrollment } = target;
  if (!enrollment.removedAt)
    return { error: "This student is not removed from the course." };
  // Its payments left with the student, so restoring it would make them
  // active in both courses with this one owing nothing it can show.
  if (isMovedAway(enrollment.removedReason))
    return {
      error:
        "This student was moved to another course. Use Change course to move them back.",
    };

  try {
    await db.enrollment.update({
      where: { id },
      data: { removedAt: null, removedReason: null },
    });
  } catch (err) {
    console.error("[restoreEnrollment]", err);
    return { error: "A database error occurred. Please try again." };
  }

  revalidateSurfaces(enrollment.userId, enrollment.courseId);
  return { error: null };
}

// Moving a student between batches of the same course rewrites one nullable
// FK. Nothing else keys off it: progress, grades, attempts, payments and
// certificates all hang off userId or enrollmentId, so they follow the student
// untouched. What does change is the lesson content they see, since
// getStudentSubjectDetail loads BatchLessonContent by enrollment.batchId.
export async function moveEnrollmentBatchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const target = await loadTarget(formData);
  if ("error" in target) return { error: target.error };

  const { id, enrollment } = target;
  if (enrollment.removedAt)
    return {
      error:
        "Restore this student to the course before moving them to another batch.",
    };

  const batchId = formData.get("batchId");
  if (typeof batchId !== "string" || !batchId)
    return { error: "Invalid batch ID." };

  // Batch.courseId is not constrained against Enrollment.courseId, so this is
  // the only thing standing between a mistyped id and a student being served
  // another course's materials.
  const batch = await db.batch.findUnique({
    where: { id: batchId },
    select: { courseId: true },
  });
  if (!batch) return { error: "Batch not found." };
  if (batch.courseId !== enrollment.courseId)
    return { error: "That batch belongs to a different course." };

  try {
    await db.enrollment.update({ where: { id }, data: { batchId } });
  } catch (err) {
    console.error("[moveEnrollmentBatch]", err);
    return { error: "A database error occurred. Please try again." };
  }

  revalidateSurfaces(enrollment.userId, enrollment.courseId);
  // The batches list carries a per-batch enrollment count, which this move
  // changes on both the source and the destination batch.
  revalidatePath("/admin/courses/" + enrollment.courseId + "/batches");
  return { error: null };
}

// Thrown inside the transaction to abort it with a message for the admin.
class MoveRefusedError extends Error {}

// Moving a student to another course fixes a wrong-level placement. Course A's
// enrollment is soft-removed, so its progress, grades and attempts stay put
// (they key off course A's own lessons and subjects and mean nothing in course
// B). The money moves: every Payment row is re-pointed at course B's
// enrollment, and computeBalance derives the new balance from those rows and
// the totalDue the admin confirms here. Matching paymentFrequency keeps each
// payment's periodMonth meaningful on the other side.
export async function moveEnrollmentCourseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const target = await loadTarget(formData);
  if ("error" in target) return { error: target.error };

  const { id, enrollment } = target;
  if (enrollment.removedAt)
    return { error: "This student is already removed from the course." };

  const courseId = formData.get("courseId");
  if (typeof courseId !== "string" || !courseId)
    return { error: "Invalid course ID." };
  if (courseId === enrollment.courseId)
    return { error: "Choose a different course." };

  const batchId = formData.get("batchId");
  if (typeof batchId !== "string" || !batchId)
    return { error: "Invalid batch ID." };

  const [source, destination, batch] = await Promise.all([
    db.course.findUnique({
      where: { id: enrollment.courseId },
      select: { paymentFrequency: true },
    }),
    db.course.findUnique({
      where: { id: courseId },
      select: { title: true, archivedAt: true, paymentFrequency: true },
    }),
    db.batch.findUnique({ where: { id: batchId }, select: { courseId: true } }),
  ]);
  if (!destination) return { error: "Course not found." };
  if (destination.archivedAt) return { error: "That course is archived." };
  if (source?.paymentFrequency !== destination.paymentFrequency)
    return {
      error:
        "These courses are billed differently, so payments cannot move between them.",
    };
  if (!batch) return { error: "Batch not found." };
  if (batch.courseId !== courseId)
    return { error: "That batch belongs to a different course." };

  // Monthly enrollments have no single agreed total; the per-month ledger is
  // their balance. Same rule as purchase approval.
  const rawTotal = formData.get("totalDue");
  const total = typeof rawTotal === "string" ? rawTotal.trim() : "";
  const totalDue =
    destination.paymentFrequency === "MONTHLY" || total === ""
      ? null
      : Number(total);
  if (totalDue !== null && (!Number.isFinite(totalDue) || totalDue < 0))
    return { error: "Total due must be zero or a positive number." };

  const { userId } = enrollment;
  try {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      // Two admins moving the same student at once would otherwise both pass
      // the checks above and both move the payments.
      await tx.$queryRaw`SELECT id FROM "Enrollment" WHERE id = ${id} FOR UPDATE`;

      const current = await tx.enrollment.findUnique({
        where: { id },
        select: { removedAt: true, paymentStatus: true, enrolledAt: true },
      });
      if (!current || current.removedAt)
        throw new MoveRefusedError(
          "This student is already removed from the course.",
        );

      const certificate = await tx.certificate.findUnique({
        where: { userId_courseId: { userId, courseId: enrollment.courseId } },
        select: { id: true },
      });
      if (certificate)
        throw new MoveRefusedError(
          "A certificate has been issued for this course, so the student can no longer be moved.",
        );

      const existing = await tx.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
        select: { id: true, removedAt: true },
      });
      if (existing && !existing.removedAt)
        throw new MoveRefusedError(
          `This student is already enrolled in ${destination.title}.`,
        );

      // Monthly billing owes every month from enrolledAt onward, so course B
      // keeps course A's start: the moved payments stay inside B's owed range
      // and a restored B row does not invent arrears from its old date.
      const data = {
        batchId,
        totalDue,
        paymentStatus: current.paymentStatus,
        enrolledAt: current.enrolledAt,
      };
      // Enrollment is unique per (userId, courseId), so an earlier removal from
      // course B must be restored rather than duplicated.
      const moved = existing
        ? await tx.enrollment.update({
            where: { id: existing.id },
            data: { ...data, removedAt: null, removedReason: null },
            select: { id: true },
          })
        : await tx.enrollment.create({
            data: { userId, courseId, ...data },
            select: { id: true },
          });

      await tx.payment.updateMany({
        where: { enrollmentId: id },
        data: { enrollmentId: moved.id },
      });

      await tx.enrollment.update({
        where: { id },
        // Clearing totalDue keeps the emptied row from reading as owing its
        // full tuition, since its payments now belong to course B.
        data: {
          removedAt: new Date(),
          removedReason: movedReason(destination.title),
          totalDue: null,
        },
      });
    });
  } catch (err) {
    if (err instanceof MoveRefusedError) return { error: err.message };
    console.error("[moveEnrollmentCourse]", err);
    return { error: "A database error occurred. Please try again." };
  }

  revalidateSurfaces(userId, enrollment.courseId);
  revalidateSurfaces(userId, courseId);
  revalidatePath("/admin/courses/" + enrollment.courseId + "/batches");
  revalidatePath("/admin/courses/" + courseId + "/batches");
  return { error: null };
}
