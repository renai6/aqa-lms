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
