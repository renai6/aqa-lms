import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Video } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getStudentDashboard } from "@/lib/student/queries";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";

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

export default async function StudentDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [{ enrollments, schedules, announcements }, user] = await Promise.all([
    getStudentDashboard(session.userId),
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
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
          Welcome{user?.firstName ? `, ${user.firstName}` : ""}!
        </h1>
        <Button asChild size="sm" className="shrink-0">
          <Link href="/student/courses">Buy more courses</Link>
        </Button>
      </div>

      {/* Schedules strip */}
      {schedules.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.2em]">
            Upcoming Schedule
          </h2>
          <div className="flex flex-wrap gap-2">
            {schedules.map((s, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-50 border border-zinc-200 px-3.5 py-1.5 text-xs font-medium text-zinc-700"
              >
                <span className="font-semibold">{s.subjectTitle}</span>
                <span className="text-zinc-300">·</span>
                <span className="text-zinc-500">
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
          <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.2em]">
            Announcements
          </h2>
          <div className="space-y-2">
            {announcements.slice(0, 3).map((a) => (
              <div
                key={a.id}
                className="flex rounded-lg bg-white overflow-hidden border border-zinc-200 shadow-sm"
              >
                <div className="w-[3px] bg-primary shrink-0" />
                <div className="px-4 py-3">
                  <p className="font-medium text-sm text-zinc-900">{a.title}</p>
                  <p className="text-sm text-zinc-500 mt-0.5 line-clamp-2">
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
        <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.2em]">
          My Courses
        </h2>
        {enrollments.length === 0 ? (
          <p className="text-sm text-zinc-400">No active enrollments.</p>
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
                  <div className="h-full rounded-xl bg-white border border-zinc-200 overflow-hidden shadow-sm group-hover:shadow-md group-hover:border-zinc-300 transition-all duration-200">
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
                      <div className="h-20 w-full bg-zinc-100" />
                    )}
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm text-zinc-900 group-hover:text-primary transition-colors duration-150">
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
                        <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{ width: pct + "%" }}
                          />
                        </div>
                        <p className="text-[11px] text-zinc-400">
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

      {/* Payment summary */}
      {partialEnrollments.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.2em]">
            Payment
          </h2>
          <div className="space-y-2">
            {partialEnrollments.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-xl bg-white border border-zinc-200 shadow-sm px-5 py-4"
              >
                <div>
                  <p className="font-semibold text-sm text-zinc-900">
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
