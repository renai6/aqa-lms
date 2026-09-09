import { type CourseType } from "@prisma/client";

// A removed enrollment still belongs to the student's history, so admin
// surfaces keep listing the course - marked, so a roster export never reads as
// though the student is still attending it.
export function formatEnrolledCourses(
  enrollments: { courseTitle: string; removedAt: Date | null }[],
): string {
  return enrollments
    .map((e) => (e.removedAt ? `${e.courseTitle} (removed)` : e.courseTitle))
    .join("; ");
}

// Read alongside the Course column, so every enrollment gets a slot in the same
// order - removed ones included, whose removal the Course column already marks.
export function formatEnrolledCourseTypes(
  enrollments: { courseType: CourseType }[],
): string {
  return enrollments
    .map((e) => (e.courseType === "ONLINE" ? "Online" : "On-Site"))
    .join("; ");
}
