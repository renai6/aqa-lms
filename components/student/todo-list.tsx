import Link from "next/link";
import type { TodoAssessment } from "@/lib/student/queries";

// Enough to act on without pushing My Courses off the screen. The list is
// already ordered by what matters most, and the remainder is counted rather
// than dropped silently.
const VISIBLE = 5;

export function TodoList({ items }: { items: TodoAssessment[] }) {
  const hidden = items.length - VISIBLE;
  return (
    <div className="space-y-2">
      {items.slice(0, VISIBLE).map((t) => (
        <Link
          key={t.assessmentId}
          href={`/student/courses/${t.courseId}/subjects/${t.subjectId}/assessments/${t.assessmentId}`}
          className="border-border hover:border-input flex items-center justify-between gap-4 rounded-xl border bg-white px-5 py-4 shadow-sm transition-all hover:shadow-md"
        >
          <div className="min-w-0">
            <p className="text-foreground truncate text-sm font-semibold">
              {t.title}
            </p>
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              {t.courseTitle} · {t.subjectTitle}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
              {t.type === "EXAM" ? "Exam" : "Quiz"}
            </span>
            <span
              className={[
                "text-xs font-medium",
                t.inProgress ? "text-amber-600" : "text-primary",
              ].join(" ")}
            >
              {t.inProgress ? "Resume" : "Start"}
            </span>
          </div>
        </Link>
      ))}
      {hidden > 0 && (
        <p className="text-muted-foreground px-1 text-xs">
          +{hidden} more in your courses
        </p>
      )}
    </div>
  );
}
