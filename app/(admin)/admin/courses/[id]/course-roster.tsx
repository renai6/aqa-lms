// app/(admin)/admin/courses/[id]/course-roster.tsx
import Link from "next/link";
import { getCourseRoster } from "@/lib/students/queries";
import {
  getCourseBatches,
  getBatchContentCoverage,
  batchLabel,
} from "@/lib/batches/queries";
import { RemoveEnrollmentButton } from "@/components/admin/remove-enrollment-button";
import { MoveEnrollmentButton } from "@/components/admin/move-enrollment-button";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

type Props = { courseId: string; courseTitle: string };

export async function CourseRoster({ courseId, courseTitle }: Props) {
  const [roster, batches, coverage] = await Promise.all([
    getCourseRoster(courseId),
    getCourseBatches(courseId),
    getBatchContentCoverage(courseId),
  ]);
  const activeCount = roster.filter((r) => !r.removedAt).length;

  const batchOptions = batches.map((b) => ({
    id: b.id,
    label: batchLabel(b) + (b.isActive ? " (current intake)" : ""),
    covered: coverage.byBatch[b.id] ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Enrolled Students</h2>
        <p className="text-muted-foreground text-sm">
          {activeCount} enrolled
          {roster.length > activeCount &&
            ` · ${roster.length - activeCount} removed`}
        </p>
      </div>

      {roster.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border py-4 text-center text-sm">
          No students enrolled yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th
                  scope="col"
                  className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Student
                </th>
                <th
                  scope="col"
                  className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Email
                </th>
                <th
                  scope="col"
                  className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Batch
                </th>
                <th
                  scope="col"
                  className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Enrolled
                </th>
                <th
                  scope="col"
                  className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Payment
                </th>
                <th scope="col" aria-label="Actions" className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {roster.map((r) => (
                <tr
                  key={r.enrollmentId}
                  className={cn(
                    "hover:bg-muted/50 transition-colors",
                    r.removedAt && "text-muted-foreground bg-muted/30",
                  )}
                >
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={"/admin/students/" + r.studentId}
                      className="hover:underline"
                    >
                      {r.firstName} {r.lastName}
                    </Link>
                    {r.removedAt && (
                      <>
                        <span className="bg-muted text-muted-foreground ml-2 inline-flex items-center rounded px-2 py-0.5 text-xs font-medium">
                          Removed
                        </span>
                        <p className="mt-0.5 text-xs font-normal">
                          {dateFormatter.format(r.removedAt)}
                          {r.removedReason && ` - ${r.removedReason}`}
                        </p>
                      </>
                    )}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{r.email}</td>
                  <td className="px-4 py-3">
                    {r.batch ? (
                      batchLabel(r.batch)
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {dateFormatter.format(r.enrolledAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                        r.removedAt
                          ? "bg-muted text-muted-foreground"
                          : r.paymentStatus === "FULLY_PAID"
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800",
                      )}
                    >
                      {r.paymentStatus === "FULLY_PAID"
                        ? "Fully Paid"
                        : "Partially Paid"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {/* A removed student has no access to move between, and
                          the action rejects them server-side. */}
                      {!r.removedAt && (
                        <MoveEnrollmentButton
                          enrollmentId={r.enrollmentId}
                          studentName={`${r.firstName} ${r.lastName}`}
                          currentBatchLabel={
                            r.batch ? batchLabel(r.batch) : null
                          }
                          batches={batchOptions.filter(
                            (b) => b.id !== r.batch?.id,
                          )}
                          totalLessons={coverage.totalLessons}
                        />
                      )}
                      <RemoveEnrollmentButton
                        enrollmentId={r.enrollmentId}
                        studentName={`${r.firstName} ${r.lastName}`}
                        courseTitle={courseTitle}
                        isRemoved={r.removedAt !== null}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
