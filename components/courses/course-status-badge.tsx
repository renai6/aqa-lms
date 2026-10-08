import type { CourseStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { COURSE_STATUS_LABEL } from "@/lib/courses/format";

const STATUS_COLORS: Record<CourseStatus, string> = {
  ENROLLMENT_ONGOING: "bg-emerald-600 text-white",
  CLASSES_ONGOING: "bg-sky-600 text-white",
  SEMESTER_ENDED: "bg-zinc-600 text-white",
};

// Light variant for admin tables, matching the Published/Draft badges.
export const COURSE_STATUS_SOFT_COLORS: Record<CourseStatus, string> = {
  ENROLLMENT_ONGOING: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CLASSES_ONGOING: "bg-sky-100 text-sky-800 border-sky-200",
  SEMESTER_ENDED: "bg-zinc-100 text-zinc-700 border-zinc-200",
};

// Colours only: each surface passes its own shape and size via className.
export function CourseStatusBadge({
  status,
  className,
}: {
  status: CourseStatus | null;
  className?: string;
}) {
  if (!status) return null;
  return (
    <span className={cn(STATUS_COLORS[status], className)}>
      {COURSE_STATUS_LABEL[status]}
    </span>
  );
}
