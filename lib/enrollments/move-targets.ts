import { db } from "@/lib/db";
import { batchLabel } from "@/lib/batches/name";
import type { CourseMoveTarget } from "@/lib/enrollments/move-options";

// Every course a student could be moved into, with its batches labelled the
// same way the batch move picker labels them. Loaded once per page and
// narrowed per enrollment by courseMoveOptions.
export async function getCourseMoveTargets(): Promise<CourseMoveTarget[]> {
  const courses = await db.course.findMany({
    where: { archivedAt: null },
    orderBy: [
      { groupName: { sort: "asc", nulls: "last" } },
      { level: { sort: "asc", nulls: "last" } },
      { title: "asc" },
    ],
    select: {
      id: true,
      title: true,
      paymentFrequency: true,
      batches: {
        orderBy: { number: "desc" },
        select: { id: true, name: true, number: true, isActive: true },
      },
    },
  });

  return courses.map((c) => ({
    id: c.id,
    title: c.title,
    paymentFrequency: c.paymentFrequency,
    batches: c.batches.map((b) => ({
      id: b.id,
      label: batchLabel(b) + (b.isActive ? " (current intake)" : ""),
    })),
  }));
}
