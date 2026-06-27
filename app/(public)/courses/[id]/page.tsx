import { notFound } from "next/navigation";
import Link from "next/link";
import { BookOpen, Clock, Monitor, MapPin } from "lucide-react";
import { getPublicCourseDetail } from "@/lib/courses/queries";

const DAY_LABEL: Record<string, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${mStr} ${period}`;
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const course = await getPublicCourseDetail(id);
  if (!course) return { title: "Course Not Found" };
  return { title: `${course.title} — Al-Qur'an Academy` };
}

export default async function PublicCourseDetailPage({ params }: Props) {
  const { id } = await params;
  const course = await getPublicCourseDetail(id);
  if (!course) notFound();

  const totalLessons = course.subjects.reduce(
    (sum, s) => sum + s._count.lessons,
    0,
  );

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative bg-zinc-900 min-h-[70vh] flex items-center pt-20 pb-0 overflow-hidden">
        {/* Grain overlay */}
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full opacity-[0.04] pointer-events-none mix-blend-overlay"
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="grain-detail">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-detail)" />
        </svg>

        {/* Crimson glow */}
        <div
          className="absolute -top-20 -left-20 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, oklch(0.525 0.223 3.958 / 0.25) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 max-w-6xl mx-auto w-full px-4 sm:px-6 py-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: course image */}
          <div className="order-2 lg:order-1">
            {course.imageUrl && /^https?:\/\//.test(course.imageUrl) ? (
              <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 aspect-[4/3]">
                <img
                  src={course.imageUrl}
                  alt={course.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 aspect-[4/3] bg-zinc-800 flex items-center justify-center">
                <span className="text-7xl font-bold text-primary">
                  {course.title.charAt(0)}
                </span>
              </div>
            )}
          </div>

          {/* Right: course info card */}
          <div className="order-1 lg:order-2 flex flex-col gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <span
                  className={[
                    "text-[11px] font-bold px-2.5 py-1 rounded-full",
                    course.courseType === "ONLINE"
                      ? "bg-blue-600/20 text-blue-300 ring-1 ring-blue-500/30"
                      : "bg-amber-600/20 text-amber-300 ring-1 ring-amber-500/30",
                  ].join(" ")}
                >
                  {course.courseType === "ONLINE" ? (
                    <span className="flex items-center gap-1">
                      <Monitor className="w-3 h-3" />
                      Online
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      On-Site
                    </span>
                  )}
                </span>
                {course.courseDuration && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-zinc-700/50 text-zinc-300 ring-1 ring-zinc-600/30 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {course.courseDuration === "SHORT"
                      ? "Short Course"
                      : "Long Course"}
                  </span>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
                {course.title}
              </h1>
              {course.description && (
                <p className="text-white/70 text-base leading-relaxed">
                  {course.description}
                </p>
              )}
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-4 text-sm text-white/60">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-primary" />
                {course.subjects.length}{" "}
                {course.subjects.length === 1 ? "Subject" : "Subjects"}
              </span>
              {totalLessons > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 flex items-center justify-center text-primary font-bold text-xs">
                    ▶
                  </span>
                  {totalLessons} Lessons
                </span>
              )}
            </div>

            {/* Price + CTA */}
            <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-5 space-y-4">
              {course.tuitionFee != null ? (
                <div>
                  <p className="text-2xl font-bold text-white">
                    ₱{course.tuitionFee.toLocaleString("en-PH")}
                  </p>
                  <p className="text-xs text-white/50 mt-0.5">
                    Flexible installments available
                  </p>
                </div>
              ) : (
                <p className="text-sm text-white/60">
                  Contact us for pricing details
                </p>
              )}
              <Link
                href="/register"
                className="block w-full text-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Enroll Now
              </Link>
              <Link
                href="/login"
                className="block w-full text-center rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/5"
              >
                Already enrolled? Log in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Curriculum tagline band ── */}
      <section className="bg-primary py-10 px-4">
        <p className="max-w-3xl mx-auto text-center text-white font-semibold text-base sm:text-lg leading-relaxed">
          AQA Curriculum is published from the Saudi Ministry curriculum &amp;
          designed for comprehensive Islamic education.
        </p>
      </section>

      {/* ── Subjects ── */}
      {course.subjects.length > 0 && (
        <section className="bg-background py-20 px-4">
          <div className="max-w-5xl mx-auto space-y-4">
            <h2 className="text-center text-2xl font-bold text-foreground mb-12">
              Course Subjects
            </h2>

            <div className="space-y-16">
              {course.subjects.map((subject, index) => {
                const isEven = index % 2 === 0;
                return (
                  <div
                    key={subject.id}
                    className={[
                      "flex flex-col gap-8 items-center",
                      isEven ? "lg:flex-row" : "lg:flex-row-reverse",
                    ].join(" ")}
                  >
                    {/* Visual block */}
                    <div className="w-full lg:w-2/5 shrink-0">
                      <div className="rounded-2xl overflow-hidden shadow-lg aspect-[4/3] relative bg-zinc-900 flex items-center justify-center">
                        {/* Decorative background pattern */}
                        <div
                          className="absolute inset-0"
                          style={{
                            background: `linear-gradient(135deg, oklch(0.525 0.223 3.958 / 0.15) 0%, oklch(0.3 0.1 3.958 / 0.3) 100%)`,
                          }}
                        />
                        <svg
                          aria-hidden="true"
                          className="absolute inset-0 h-full w-full opacity-[0.06] pointer-events-none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <filter id={`grain-subj-${index}`}>
                            <feTurbulence
                              type="fractalNoise"
                              baseFrequency="0.65"
                              numOctaves="3"
                              stitchTiles="stitch"
                            />
                            <feColorMatrix type="saturate" values="0" />
                          </filter>
                          <rect
                            width="100%"
                            height="100%"
                            filter={`url(#grain-subj-${index})`}
                          />
                        </svg>
                        <div className="relative z-10 text-center px-6">
                          <span className="block text-6xl font-black text-white/20 leading-none select-none">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <p className="mt-2 text-lg font-bold text-white/80 leading-tight">
                            {subject.title}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Text block */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-primary uppercase tracking-widest">
                          Subject {index + 1}
                        </span>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-foreground">
                        {subject.title}
                      </h3>
                      {subject.description ? (
                        <p className="text-muted-foreground leading-relaxed">
                          {subject.description}
                        </p>
                      ) : (
                        <p className="text-muted-foreground/60 italic text-sm">
                          No description available.
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-2">
                        {subject._count.lessons > 0 && (
                          <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                            <BookOpen className="w-3.5 h-3.5" />
                            {subject._count.lessons}{" "}
                            {subject._count.lessons === 1
                              ? "Lesson"
                              : "Lessons"}
                          </span>
                        )}
                        {subject.units > 0 && (
                          <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                            {subject.units}{" "}
                            {subject.units === 1 ? "Unit" : "Units"}
                          </span>
                        )}
                        {subject.schedules.map((s, si) => (
                          <span
                            key={si}
                            className="flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-medium text-primary"
                          >
                            <Clock className="w-3 h-3" />
                            {DAY_LABEL[s.day]} {formatTime(s.startTime)}–
                            {formatTime(s.endTime)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Bottom CTA ── */}
      <section className="bg-zinc-900 py-16 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <p className="text-white/70 text-sm leading-relaxed">
            All courses support flexible installment payments. Pay a partial
            amount upfront and complete your tuition over time.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center rounded-full bg-primary px-8 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Register to Enroll
          </Link>
        </div>
      </section>
    </>
  );
}
