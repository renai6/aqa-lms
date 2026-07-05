import { notFound } from "next/navigation";
import Link from "next/link";
import { BookOpen, Clock, Monitor, MapPin } from "lucide-react";
import { getPublicCourseDetail } from "@/lib/courses/queries";
import Eyebrow from "@/components/homepage/Eyebrow";
import Reveal from "@/components/homepage/Reveal";
import GeoMotif from "@/components/homepage/GeoMotif";

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
      <section className="relative flex min-h-[70vh] items-center overflow-hidden bg-black pt-28 pb-0">
        {/* Base wash + depth */}
        <div className="absolute inset-0 bg-[linear-gradient(140deg,#0b0b0f_0%,#070709_45%,#000000_100%)]" />
        <div className="pointer-events-none absolute -top-40 -left-24 h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle,rgba(236,204,105,0.12),transparent_65%)]" />

        {/* Fine grid lines */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgba(236,204,105,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(236,204,105,0.05) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Geometric motif */}
        <GeoMotif className="-top-20 right-[-6rem]" />

        <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 py-16 sm:px-10 lg:grid-cols-2 lg:px-16">
          {/* Left: course image */}
          <div className="order-2 animate-[fadeUp_0.9s_0.3s_both] lg:order-1">
            {course.imageUrl && /^https?:\/\//.test(course.imageUrl) ? (
              <div className="ring-gold/15 relative aspect-[4/3] overflow-hidden shadow-2xl ring-1">
                <img
                  src={course.imageUrl}
                  alt={course.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
            ) : (
              <div className="bg-primary ring-gold/15 flex aspect-[4/3] items-center justify-center overflow-hidden shadow-2xl ring-1">
                <span className="text-gold text-7xl font-semibold">
                  {course.title.charAt(0)}
                </span>
              </div>
            )}
          </div>

          {/* Right: course info card */}
          <div className="order-1 flex flex-col gap-6 lg:order-2">
            <div className="space-y-3">
              <div className="flex animate-[fadeUp_0.9s_0.1s_both] flex-wrap gap-2">
                <span
                  className={[
                    "px-3 py-1 text-[11px] font-bold tracking-[0.12em] uppercase ring-1",
                    course.courseType === "ONLINE"
                      ? "bg-gold/15 text-gold ring-gold/30"
                      : "bg-white/10 text-white/80 ring-white/20",
                  ].join(" ")}
                >
                  {course.courseType === "ONLINE" ? (
                    <span className="flex items-center gap-1.5">
                      <Monitor className="h-3 w-3" />
                      Online
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" />
                      On-Site
                    </span>
                  )}
                </span>
                {course.courseDuration && (
                  <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1 text-[11px] font-bold tracking-[0.12em] text-white/60 uppercase ring-1 ring-white/10">
                    <Clock className="h-3 w-3" />
                    {course.courseDuration === "SHORT"
                      ? "Short Course"
                      : "Long Course"}
                  </span>
                )}
              </div>
              <h1 className="animate-[fadeUp_0.9s_0.2s_both] text-3xl leading-tight font-semibold text-white sm:text-4xl lg:text-5xl">
                {course.title}
              </h1>
              {course.description && (
                <p className="animate-[fadeUp_0.9s_0.3s_both] text-base leading-relaxed font-light text-white/70">
                  {course.description}
                </p>
              )}
            </div>

            {/* Stats row */}
            <div className="flex animate-[fadeUp_0.9s_0.4s_both] flex-wrap gap-5 text-sm text-white/60">
              <span className="flex items-center gap-1.5">
                <BookOpen className="text-gold h-4 w-4" />
                {course.subjects.length}{" "}
                {course.subjects.length === 1 ? "Subject" : "Subjects"}
              </span>
              {totalLessons > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="text-gold flex h-4 w-4 items-center justify-center text-xs font-bold">
                    ▶
                  </span>
                  {totalLessons} Lessons
                </span>
              )}
            </div>

            {/* Price + CTA */}
            <div className="ring-gold/15 animate-[fadeUp_0.9s_0.5s_both] space-y-4 bg-white/5 p-6 ring-1">
              {course.tuitionFee != null ? (
                <div>
                  <p className="text-2xl font-bold text-white">
                    ₱{course.tuitionFee.toLocaleString("en-PH")}
                  </p>
                  <p className="mt-0.5 text-xs text-white/50">
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
                className="bg-gold text-primary hover:bg-gold-soft block w-full px-6 py-3 text-center text-[11px] font-bold tracking-[0.18em] uppercase transition-colors"
              >
                Enroll Now
              </Link>
              <Link
                href="/login"
                className="block w-full border border-white/20 px-6 py-3 text-center text-[11px] font-semibold tracking-[0.15em] text-white/80 uppercase transition-colors hover:border-white/50 hover:text-white"
              >
                Already enrolled? Log in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Curriculum tagline band ── */}
      <section className="bg-primary relative overflow-hidden px-6 py-14">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgba(236,204,105,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(236,204,105,0.04) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />
        <Reveal className="relative mx-auto max-w-3xl text-center">
          <Eyebrow center className="mb-5">
            AQA Curriculum
          </Eyebrow>
          <p className="text-lg leading-relaxed font-light text-white/85 sm:text-xl">
            AQA Curriculum is published from the Saudi Ministry curriculum &amp;
            designed for comprehensive Islamic education.
          </p>
        </Reveal>
      </section>

      {/* ── Subjects ── */}
      {course.subjects.length > 0 && (
        <section className="bg-[#f4f7fa] px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <Reveal className="mb-16 text-center">
              <Eyebrow center className="mb-3">
                Curriculum
              </Eyebrow>
              <h2 className="text-primary text-3xl font-semibold tracking-tight sm:text-4xl">
                Course Subjects
              </h2>
            </Reveal>

            <div className="space-y-16">
              {course.subjects.map((subject, index) => {
                const isEven = index % 2 === 0;
                return (
                  <Reveal key={subject.id}>
                    <div
                      className={[
                        "flex flex-col items-center gap-8",
                        isEven ? "lg:flex-row" : "lg:flex-row-reverse",
                      ].join(" ")}
                    >
                      {/* Visual block */}
                      <div className="w-full shrink-0 lg:w-2/5">
                        <div className="bg-primary relative flex aspect-[4/3] items-center justify-center overflow-hidden shadow-xl">
                          {/* Grid + glow */}
                          <div
                            className="absolute inset-0 opacity-60"
                            style={{
                              backgroundImage:
                                "linear-gradient(rgba(236,204,105,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(236,204,105,0.05) 1px, transparent 1px)",
                              backgroundSize: "40px 40px",
                            }}
                          />
                          <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(236,204,105,0.15),transparent_65%)]" />
                          <div className="relative z-10 px-6 text-center">
                            <span className="text-gold/25 block text-6xl leading-none font-bold select-none">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <p className="mt-2 text-lg leading-tight font-semibold text-white/85">
                              {subject.title}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Text block */}
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3">
                          <span className="text-gold text-[10px] font-bold tracking-[0.28em] uppercase">
                            Subject {index + 1}
                          </span>
                          <div className="bg-gold/30 h-px flex-1" />
                        </div>
                        <h3 className="text-primary text-xl font-semibold sm:text-2xl">
                          {subject.title}
                        </h3>
                        {subject.description ? (
                          <p className="text-muted-foreground leading-relaxed font-light">
                            {subject.description}
                          </p>
                        ) : (
                          <p className="text-muted-foreground/60 text-sm italic">
                            No description available.
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 pt-2">
                          {subject.gender && (
                            <span className="border-gold/40 text-primary bg-gold/10 flex items-center gap-1.5 border px-3 py-1 text-xs font-semibold">
                              {subject.gender === "MALE"
                                ? "Brothers only"
                                : "Sisters only"}
                            </span>
                          )}
                          {subject._count.lessons > 0 && (
                            <span className="bg-muted text-muted-foreground flex items-center gap-1.5 px-3 py-1 text-xs font-medium">
                              <BookOpen className="h-3.5 w-3.5" />
                              {subject._count.lessons}{" "}
                              {subject._count.lessons === 1
                                ? "Lesson"
                                : "Lessons"}
                            </span>
                          )}
                          {subject.units > 0 && (
                            <span className="bg-muted text-muted-foreground flex items-center gap-1.5 px-3 py-1 text-xs font-medium">
                              {subject.units}{" "}
                              {subject.units === 1 ? "Unit" : "Units"}
                            </span>
                          )}
                          {subject.schedules.map((s, si) => (
                            <span
                              key={si}
                              className="border-primary/20 text-primary bg-primary/5 flex items-center gap-1.5 border px-3 py-1 text-xs font-medium"
                            >
                              <Clock className="h-3 w-3" />
                              {DAY_LABEL[s.day]} {formatTime(s.startTime)}–
                              {formatTime(s.endTime)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Bottom CTA ── */}
      <section className="relative overflow-hidden bg-black px-6 py-20">
        <div className="absolute inset-0 bg-[linear-gradient(140deg,#0b0b0f_0%,#070709_50%,#000000_100%)]" />
        <div className="pointer-events-none absolute -bottom-32 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(236,204,105,0.1),transparent_65%)]" />
        <GeoMotif className="-top-40 left-[-8rem]" />
        <Reveal className="relative mx-auto max-w-2xl space-y-7 text-center">
          <Eyebrow center>Begin Your Journey</Eyebrow>
          <p className="text-sm leading-relaxed font-light text-white/70">
            All courses support flexible installment payments. Pay a partial
            amount upfront and complete your tuition over time.
          </p>
          <Link
            href="/register"
            className="bg-gold text-primary hover:bg-gold-soft inline-flex items-center px-8 py-3.5 text-[11px] font-bold tracking-[0.2em] uppercase transition-all hover:-translate-y-0.5"
          >
            Register to Enroll
          </Link>
        </Reveal>
      </section>
    </>
  );
}
