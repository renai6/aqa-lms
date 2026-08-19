import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getSession } from "@/lib/auth/session";
import { getStudentDashboard, getStudentRecentResults } from "@/lib/student/queries";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock } from "lucide-react";

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${mStr} ${period}`;
}

const DAY_LABEL: Record<string, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

export const metadata = { title: "Dashboard — AQA Student" };

type Props = { searchParams: Promise<{ enrolled?: string }> };

export default async function StudentDashboardPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { enrolled } = await searchParams;
  const justEnrolled = enrolled === "1";

  const [
    { enrollments, schedules, announcements, pendingPurchases },
    recentResults,
    user,
  ] = await Promise.all([
    getStudentDashboard(session.userId),
    getStudentRecentResults(session.userId),
    db.user.findUnique({
      where: { id: session.userId },
      select: { firstName: true },
    }),
  ]);

  const partialEnrollments = enrollments.filter(
    (e) => e.paymentStatus === "PARTIALLY_PAID",
  );

  return (
    <div className="px-6 md:px-10 py-10 space-y-12">
      {/* Page title */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Welcome{user?.firstName ? `, ${user.firstName}` : ""}!
        </h1>
        <Button asChild size="sm" className="shrink-0">
          <Link href="/student/courses">Enroll to other courses</Link>
        </Button>
      </div>

      {/* Enrollment success banner (shown right after checkout) */}
      {justEnrolled && (
        <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div className="space-y-1">
            <p className="font-semibold text-sm text-emerald-900">
              Congratulations! Your enrollment has been submitted. 🎉
            </p>
            <p className="text-sm text-emerald-700">
              Our admin team will review your enrollment and payment first.
              Once approved, the program will appear in your dashboard and
              you&apos;ll be able to access it.
            </p>
          </div>
        </div>
      )}

      {/* Pending enrollments awaiting admin review */}
      {pendingPurchases.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">
            Pending Enrollments
          </h2>
          <div className="space-y-2">
            {pendingPurchases.map((p) => (
              <div
                key={p.id}
                className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm"
              >
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-sm text-amber-900">
                    {p.courseTitles.length > 0
                      ? p.courseTitles.join(", ")
                      : "Enrollment"}
                  </p>
                  <p className="text-sm text-amber-700">
                    Awaiting admin review. You&apos;ll be able to access the
                    program here once your enrollment is approved.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Schedules strip */}
      {schedules.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">
            Upcoming Schedule
          </h2>
          <div className="flex flex-wrap gap-2">
            {schedules.map((s, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 border border-border px-3.5 py-1.5 text-xs font-medium text-foreground"
              >
                <span className="font-semibold">{s.subjectTitle}</span>
                <span className="text-muted-foreground/60">·</span>
                <span className="text-muted-foreground">
                  {DAY_LABEL[s.day]} {formatTime(s.startTime)}–
                  {formatTime(s.endTime)}
                </span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">
            Announcements
          </h2>
          <div className="space-y-2">
            {announcements.slice(0, 3).map((a) => (
              <div
                key={a.id}
                className="flex rounded-lg bg-white overflow-hidden border border-border shadow-sm"
              >
                <div className="w-[3px] bg-primary shrink-0" />
                <div className="px-4 py-3">
                  <p className="font-medium text-sm text-foreground">{a.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                    {a.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* My Courses */}
      <section className="space-y-4">
        <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">
          My Courses
        </h2>
        {enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active enrollments.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {enrollments.map((e) => {
              const pct =
                e.totalLessons > 0
                  ? Math.round((e.completedLessons / e.totalLessons) * 100)
                  : 0;
              return (
                <div key={e.id} className="relative group">
                  {/* Card overlay link — covers whole card for primary navigation */}
                  <Link
                    href={"/student/courses/" + e.courseId}
                    className="absolute inset-0 z-0 rounded-xl"
                    aria-label={e.course.title}
                  />
                  <div className="h-full rounded-xl bg-white border border-border overflow-hidden shadow-sm group-hover:shadow-md group-hover:border-input transition-all duration-200">
                    {e.course.imageUrl ? (
                      <div className="relative h-72 w-full overflow-hidden">
                        <Image
                          src={e.course.imageUrl}
                          alt={e.course.title}
                          fill
                          className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      </div>
                    ) : (
                      <div className="h-20 w-full bg-muted" />
                    )}
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors duration-150">
                          {e.course.title}
                        </p>
                        <span
                          className={[
                            "shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border",
                            e.paymentStatus === "FULLY_PAID"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200",
                          ].join(" ")}
                        >
                          {e.paymentStatus === "FULLY_PAID"
                            ? "Paid"
                            : "Partial"}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{ width: pct + "%" }}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {e.completedLessons} of {e.totalLessons} lessons
                          completed
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Results */}
      {recentResults.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">
            Recent Results
          </h2>
          <div className="space-y-2">
            {recentResults.map((r) => {
              const awaiting = r.score === null;
              const passed =
                r.score !== null && r.passingScore !== null
                  ? r.score >= r.passingScore
                  : null;
              return (
                <Link
                  key={r.attemptId}
                  href={`/student/courses/${r.courseId}/subjects/${r.subjectId}/assessments/${r.assessmentId}/attempt/${r.attemptId}`}
                  className="flex items-center justify-between gap-4 rounded-xl bg-white border border-border shadow-sm px-5 py-4 hover:border-input hover:shadow-md transition-all"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {r.assessmentTitle}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {r.courseTitle} · {r.subjectTitle}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    {awaiting ? (
                      <span className="text-xs font-medium text-amber-600">
                        Awaiting grading
                      </span>
                    ) : (
                      <>
                        <span className="text-sm font-bold text-foreground tabular-nums">
                          {Math.round(r.score as number)}%
                        </span>
                        {passed !== null && (
                          <span
                            className={[
                              "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border",
                              passed
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-red-50 text-red-700 border-red-200",
                            ].join(" ")}
                          >
                            {passed ? "Pass" : "Fail"}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Payment summary */}
      {partialEnrollments.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">
            Payment
          </h2>
          <div className="space-y-2">
            {partialEnrollments.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-xl bg-white border border-border shadow-sm px-5 py-4"
              >
                <div>
                  <p className="font-semibold text-sm text-foreground">
                    {e.course.title}
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Partial payment — balance outstanding
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
