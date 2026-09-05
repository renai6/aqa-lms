"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

type ActionState = { error: string | null };

// Removing a student from a course is reversible and destroys nothing. The
// Enrollment row stays, keeping its payments, grades, progress and certificate
// attached, so the academic and financial record survives an admin correction.
// The student simply stops seeing the course.

async function loadTarget(formData: FormData): Promise<
  | { error: string }
  | {
      id: string;
      enrollment: { userId: string; courseId: string; removedAt: Date | null };
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
    select: { userId: true, courseId: true, removedAt: true },
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
