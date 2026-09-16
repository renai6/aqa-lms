import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getSession } from "@/lib/auth/session";
import {
  getStudentDashboard,
  getStudentRecentResults,
  DASHBOARD_ANNOUNCEMENTS,
  type DashboardEnrollment,
} from "@/lib/student/queries";
import {
  getEnrollmentPaymentStates,
  getEnrollmentBalances,
  type EnrollmentBalanceInfo,
} from "@/lib/payments/queries";
import { describeBalance } from "@/lib/payments/balance";
import { isSettled } from "@/lib/payments/guards";
import { db } from "@/lib/db";
import { ScheduleStrip } from "@/components/schedule/schedule-strip";
import { AnnouncementCard } from "@/components/student/announcement-card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock } from "lucide-react";

// Two levels of section label, so the page has a hierarchy instead of five
// identical whispers. My Courses is what a student came for and reads as a
// real heading; everything else stays a quiet eyebrow above its cards.
const SECTION_LABEL =
  "text-muted-foreground text-[11px] font-semibold tracking-[0.15em] uppercase";
const SECTION_HEADING = "text-foreground text-base font-bold tracking-tight";

function balanceLine(
  info: EnrollmentBalanceInfo | undefined,
  course: DashboardEnrollment["course"],
): string {
  // MONTHLY is decided first, regardless of `balance.kind`: a handful of
  // legacy monthly enrollments still carry a lifetime `totalDue` (a bug
  // elsewhere, not fixed by hiding its symptom here), which made `balance`
  // read "tracked" and this branch unreachable for exactly the enrollments
  // that most needed the month-based line.
  if (course.paymentFrequency === "MONTHLY") {
    return info?.monthlyLine ?? "Billed monthly";
  }
  if (info && info.balance.kind === "tracked") return describeBalance(info.balance);
  return "Partial payment - balance outstanding";
}

// Settled reads positive, outstanding (or nothing to score) reads amber -
// the same convention `BalanceSummary` follows for the equivalent line on
// the admin side.
function monthlyTone(line: string | null): string {
  if (line === null) return "text-muted-foreground";
  if (line.startsWith("Paid up through")) return "text-green-700";
  if (line === "Billed monthly") return "text-muted-foreground";
  return "text-amber-600";
}

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
        balance: balances[e.id]?.balance ?? { kind: "untracked" },
        paymentFrequency: e.course.paymentFrequency,
      }),
  );

  const hasAnnouncements = announcements.length > 0;

  // A lone card stranded in a three-column grid left two thirds of the row
  // empty, so a single enrollment renders as one wide row with its image
  // beside the text. Two already fill the grid on their own, and look denser
  // in it than they did as a pair of near-empty full-width rows.
  const wideCards = enrollments.length === 1;

  return (
    <div className="mx-auto max-w-[1400px] space-y-12 px-6 py-10 md:px-10">
      {/* Page title */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          Welcome{user?.firstName ? `, ${user.firstName}` : ""}!
        </h1>
        <Button asChild size="sm" className="shrink-0">
          <Link href="/student/courses">Enroll to other courses</Link>
        </Button>
      </div>

      <div
        className={
          hasAnnouncements
            ? // A fixed rail rather than a third of the viewport: at desktop
              // widths a fractional column handed ~590px to the least
              // actionable content on the page.
              "grid grid-cols-1 items-start gap-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10"
            : undefined
        }
      >
        {/* Announcements: the right-hand column on large screens. First in
            source order so on small screens it sits near the top instead of
            below every course and payment. */}
        {hasAnnouncements && (
          <section className="min-w-0 space-y-3 lg:order-last">
            <div className="flex items-center justify-between gap-4">
              <h2 className={SECTION_LABEL}>Announcements</h2>
              {announcements.length > DASHBOARD_ANNOUNCEMENTS && (
                <Link
                  href="/student/announcements"
                  className="text-primary text-xs font-medium hover:underline"
                >
                  View all
                </Link>
              )}
            </div>
            <div className="space-y-2">
              {announcements.slice(0, DASHBOARD_ANNOUNCEMENTS).map((a) => (
                <AnnouncementCard
                  key={a.id}
                  announcement={a}
                  variant="compact"
                />
              ))}
            </div>
          </section>
        )}

        <div className="min-w-0 space-y-12">
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
              <h2 className={SECTION_LABEL}>Pending Enrollments</h2>
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
          <ScheduleStrip schedules={schedules} />

          {/* My Courses */}
          <section className="space-y-4">
            <h2 className={SECTION_HEADING}>My Courses</h2>
            {enrollments.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No active enrollments.
              </p>
            ) : (
              <div
                className={
                  wideCards
                    ? // Capped, or one card stretches the whole column and
                      // goes hollow in the middle.
                      "grid max-w-2xl grid-cols-1 gap-4"
                    : hasAnnouncements
                      ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
                      : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                }
              >
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
                      <div
                        className={[
                          "border-border group-hover:border-input h-full overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-200 group-hover:shadow-md",
                          wideCards ? "flex flex-col sm:flex-row" : "",
                        ].join(" ")}
                      >
                        {/* A ratio rather than a fixed h-72: the image used to
                            stand taller than everything below it, and cropped
                            a poster through its own title. */}
                        {e.course.imageUrl ? (
                          <div
                            className={[
                              "relative w-full shrink-0 overflow-hidden",
                              wideCards
                                ? "aspect-[16/9] sm:aspect-[4/3] sm:w-56"
                                : "aspect-[4/3]",
                            ].join(" ")}
                          >
                            <Image
                              src={e.course.imageUrl}
                              alt={e.course.title}
                              fill
                              sizes="(min-width: 1024px) 24rem, 100vw"
                              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            />
                          </div>
                        ) : (
                          <div
                            className={[
                              "bg-muted w-full shrink-0",
                              wideCards
                                ? "aspect-[16/9] sm:aspect-[4/3] sm:w-56"
                                : "aspect-[4/3]",
                            ].join(" ")}
                          />
                        )}
                        <div
                          className={[
                            "space-y-3 p-4",
                            wideCards ? "flex-1 sm:self-center" : "",
                          ].join(" ")}
                        >
                          <div
                            className={[
                              "flex items-start gap-2",
                              // At full width `justify-between` strands the
                              // badge hundreds of pixels from the title it
                              // labels, so a wide card keeps the two together.
                              wideCards ? "" : "justify-between",
                            ].join(" ")}
                          >
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
                          {/* A course with no lessons has no progress to
                              report: the bar could never fill, and "0 of 0"
                              reads as a fault rather than an empty course. */}
                          {e.totalLessons > 0 ? (
                            <div
                              className={[
                                "space-y-1",
                                // Capped, or the bar becomes a hairline drawn
                                // across the whole card.
                                wideCards ? "max-w-md" : "",
                              ].join(" ")}
                            >
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
                          ) : (
                            <p className="text-muted-foreground text-[11px]">
                              No lessons yet
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Payment summary. Above Recent Results because an outstanding
              balance is the most time-sensitive thing on this page and used
              to sit below the fold. */}
          {unsettledEnrollments.length > 0 && (
            <section className="space-y-4">
              <h2 className={SECTION_LABEL}>Payment</h2>
              <div className="space-y-2">
                {unsettledEnrollments.map((e) => {
                  const state = paymentStates[e.id] ?? { kind: "idle" as const };
                  const info = balances[e.id];
                  // A monthly enrollment settles a month at a time, so a payment
                  // under review for July must not block submitting August. The
                  // guard already allows it; hiding the button was the only thing
                  // stopping a student catching up.
                  const isMonthly = e.course.paymentFrequency === "MONTHLY";
                  return (
                    <div
                      key={e.id}
                      className="border-border flex items-center justify-between gap-4 rounded-xl border bg-white px-5 py-4 shadow-sm"
                    >
                      <div className="min-w-0">
                        <p className="text-foreground text-sm font-semibold">
                          {e.course.title}
                        </p>
                        <p
                          className={`mt-0.5 text-xs ${
                            isMonthly
                              ? monthlyTone(info?.monthlyLine ?? null)
                              : "text-amber-600"
                          }`}
                        >
                          {balanceLine(info, e.course)}
                        </p>
                        {state.kind === "rejected" && (
                          <p className="text-destructive mt-1 text-xs">
                            Your last payment was rejected
                            {state.reason ? `: ${state.reason}` : "."}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {state.kind === "pending" && (
                          <span className="text-xs font-medium text-amber-600">
                            Payment under review
                          </span>
                        )}
                        {(state.kind !== "pending" || isMonthly) && (
                          <Button asChild size="sm">
                            <Link href={"/student/payments/" + e.id}>
                              Add payment
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Recent Results */}
          {recentResults.length > 0 && (
            <section className="space-y-4">
              <h2 className={SECTION_LABEL}>Recent Results</h2>
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
        </div>
      </div>
    </div>
  );
}
