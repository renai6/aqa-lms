import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getSession } from "@/lib/auth/session";
import {
  getStudentDashboard,
  getStudentRecentResults,
} from "@/lib/student/queries";
import {
  getEnrollmentPaymentStates,
  getEnrollmentBalances,
} from "@/lib/payments/queries";
import { describeBalance, type Balance } from "@/lib/payments/balance";
import { isSettled } from "@/lib/payments/guards";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock } from "lucide-react";

function balanceLine(balance: Balance | undefined): string {
  if (balance && balance.kind === "tracked") return describeBalance(balance);
  return "Partial payment - balance outstanding";
}

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

type Props = { searchParams: Promise<{ enrolled?: string; payment?: string }> };

export default async function StudentDashboardPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { enrolled, payment } = await searchParams;
  const justEnrolled = enrolled === "1";
  const justPaid = payment === "1";

  const [
    { enrollments, schedules, announcements, pendingPurchases },
    recentResults,
    user,
    paymentStates,
    balances,
  ] = await Promise.all([
    getStudentDashboard(session.userId),
    getStudentRecentResults(session.userId),
    db.user.findUnique({
      where: { id: session.userId },
      select: { firstName: true },
    }),
    getEnrollmentPaymentStates(session.userId),
    getEnrollmentBalances(session.userId),
  ]);

  // Same rule the payment guard enforces, so the button offered here and the
  // action behind it cannot disagree. An enrollment an admin labelled
  // FULLY_PAID while the ledger still shows a balance stays payable.
  const unsettledEnrollments = enrollments.filter(
    (e) =>
      !isSettled({
        paymentStatus: e.paymentStatus,
        balance: balances[e.id] ?? { kind: "untracked" },
      }),
  );

  return (
    <div className="space-y-12 px-6 py-10 md:px-10">
      {/* Page title */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
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
            <p className="text-sm font-semibold text-emerald-900">
              Congratulations! Your enrollment has been submitted. 🎉
            </p>
            <p className="text-sm text-emerald-700">
              Our admin team will review your enrollment and payment first. Once
              approved, the program will appear in your dashboard and
              you&apos;ll be able to access it.
            </p>
          </div>
        </div>
      )}

      {/* Additional-payment success banner (shown right after submitting) */}
      {justPaid && (
        <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-emerald-900">
              Your payment has been submitted for review.
            </p>
            <p className="text-sm text-emerald-700">
              Our admin team will verify your proof of payment. Your payment
              status here updates once it is approved.
            </p>
          </div>
        </div>
      )}

      {/* Pending enrollments awaiting admin review */}
      {pendingPurchases.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-muted-foreground text-[10px] font-semibold tracking-[0.2em] uppercase">
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
                  <p className="text-sm font-semibold text-amber-900">
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
          <h2 className="text-muted-foreground text-[10px] font-semibold tracking-[0.2em] uppercase">
            Upcoming Schedule
          </h2>
          <div className="flex flex-wrap gap-2">
            {schedules.map((s, i) => (
              <span
                key={i}
                className="bg-muted/60 border-border text-foreground inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium"
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
          <h2 className="text-muted-foreground text-[10px] font-semibold tracking-[0.2em] uppercase">
            Announcements
          </h2>
          <div className="space-y-2">
            {announcements.slice(0, 3).map((a) => (
              <div
                key={a.id}
                className="border-border flex overflow-hidden rounded-lg border bg-white shadow-sm"
              >
                <div className="bg-primary w-[3px] shrink-0" />
                <div className="px-4 py-3">
                  <p className="text-foreground text-sm font-medium">
                    {a.title}
                  </p>
                  <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">
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
        <h2 className="text-muted-foreground text-[10px] font-semibold tracking-[0.2em] uppercase">
          My Courses
        </h2>
        {enrollments.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No active enrollments.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {enrollments.map((e) => {
              const pct =
                e.totalLessons > 0
                  ? Math.round((e.completedLessons / e.totalLessons) * 100)
                  : 0;
              return (
                <div key={e.id} className="group relative">
                  {/* Card overlay link — covers whole card for primary navigation */}
                  <Link
                    href={"/student/courses/" + e.courseId}
                    className="absolute inset-0 z-0 rounded-xl"
                    aria-label={e.course.title}
                  />
                  <div className="border-border group-hover:border-input h-full overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-200 group-hover:shadow-md">
                    {e.course.imageUrl ? (
                      <div className="relative h-72 w-full overflow-hidden">
                        <Image
                          src={e.course.imageUrl}
                          alt={e.course.title}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      </div>
                    ) : (
                      <div className="bg-muted h-20 w-full" />
                    )}
                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-foreground group-hover:text-primary text-sm font-semibold transition-colors duration-150">
                          {e.course.title}
                        </p>
                        <span
                          className={[
                            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase",
                            e.paymentStatus === "FULLY_PAID"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-amber-200 bg-amber-50 text-amber-700",
                          ].join(" ")}
                        >
                          {e.paymentStatus === "FULLY_PAID"
                            ? "Paid"
                            : "Partial"}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                          <div
                            className="bg-primary h-full rounded-full transition-all duration-300"
                            style={{ width: pct + "%" }}
                          />
                        </div>
                        <p className="text-muted-foreground text-[11px]">
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
          <h2 className="text-muted-foreground text-[10px] font-semibold tracking-[0.2em] uppercase">
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
                  className="border-border hover:border-input flex items-center justify-between gap-4 rounded-xl border bg-white px-5 py-4 shadow-sm transition-all hover:shadow-md"
                >
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm font-semibold">
                      {r.assessmentTitle}
                    </p>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {r.courseTitle} · {r.subjectTitle}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {awaiting ? (
                      <span className="text-xs font-medium text-amber-600">
                        Awaiting grading
                      </span>
                    ) : (
                      <>
                        <span className="text-foreground text-sm font-bold tabular-nums">
                          {Math.round(r.score as number)}%
                        </span>
                        {passed !== null && (
                          <span
                            className={[
                              "rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase",
                              passed
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-red-200 bg-red-50 text-red-700",
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
      {unsettledEnrollments.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-muted-foreground text-[10px] font-semibold tracking-[0.2em] uppercase">
            Payment
          </h2>
          <div className="space-y-2">
            {unsettledEnrollments.map((e) => {
              const state = paymentStates[e.id] ?? { kind: "idle" as const };
              return (
                <div
                  key={e.id}
                  className="border-border flex items-center justify-between gap-4 rounded-xl border bg-white px-5 py-4 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="text-foreground text-sm font-semibold">
                      {e.course.title}
                    </p>
                    <p className="mt-0.5 text-xs text-amber-600">
                      {balanceLine(balances[e.id])}
                    </p>
                    {state.kind === "rejected" && (
                      <p className="text-destructive mt-1 text-xs">
                        Your last payment was rejected
                        {state.reason ? `: ${state.reason}` : "."}
                      </p>
                    )}
                  </div>
                  {state.kind === "pending" ? (
                    <span className="shrink-0 text-xs font-medium text-amber-600">
                      Payment under review
                    </span>
                  ) : (
                    <Button asChild size="sm" className="shrink-0">
                      <Link href={"/student/payments/" + e.id}>
                        Add payment
                      </Link>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
