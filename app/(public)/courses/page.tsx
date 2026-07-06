import Link from "next/link";
import { BookOpen } from "lucide-react";
import { getPublishedCourses } from "@/lib/courses/queries";
import { priceSuffix } from "@/lib/courses/format";
import type { CourseType } from "@prisma/client";
import Eyebrow from "@/components/homepage/Eyebrow";
import Reveal from "@/components/homepage/Reveal";
import GeoMotif from "@/components/homepage/GeoMotif";

export const metadata = { title: "Courses — Al-Qur'an Academy" };

const TYPES: { label: string; value: CourseType | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Online", value: "ONLINE" },
  { label: "On-Site", value: "ON_SITE" },
];

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const activeType =
    type === "ON_SITE" || type === "ONLINE" ? (type as CourseType) : undefined;
  const courses = await getPublishedCourses(activeType);

  return (
    <>
      {/* ── Hero Banner ── */}
      <section className="relative flex min-h-[52vh] items-center overflow-hidden bg-black pt-28 pb-20">
        {/* Base wash + depth */}
        <div className="absolute inset-0 bg-[linear-gradient(140deg,#0b0b0f_0%,#070709_45%,#000000_100%)]" />
        <div className="absolute -top-40 -right-24 h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle,rgba(236,204,105,0.12),transparent_65%)]" />

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
        <GeoMotif className="-top-20 -right-20" />

        {/* Left vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_20%_50%,transparent_40%,rgba(0,0,0,0.6)_100%)]" />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 sm:px-10 lg:px-16">
          <div className="animate-[fadeUp_0.9s_0.1s_both]">
            <Eyebrow>Enrollment Open — Semester 2026</Eyebrow>
          </div>
          <h1 className="mt-6 animate-[fadeUp_0.9s_0.2s_both] text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Explore Our <span className="text-gold font-normal">Courses</span>
          </h1>
          <p className="mt-5 max-w-xl animate-[fadeUp_0.9s_0.32s_both] text-sm leading-relaxed font-light text-white/70">
            Guided by the Saudi Ministry curriculum — online and face-to-face
            programs for every learner.
          </p>
        </div>
      </section>

      {/* ── Course List or Empty State ── */}
      <section className="bg-[#f4f7fa]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          {/* Header + filter tabs */}
          <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Eyebrow className="mb-3">Academic Programs</Eyebrow>
              <h2 className="text-primary text-3xl font-semibold tracking-tight sm:text-4xl">
                Browse Programs
              </h2>
            </div>
            <div className="flex gap-2">
              {TYPES.map((t) => {
                const isActive =
                  (t.value === "ALL" && !activeType) || t.value === activeType;
                const href =
                  t.value === "ALL" ? "/courses" : `/courses?type=${t.value}`;
                return (
                  <Link
                    key={t.value}
                    href={href}
                    className={[
                      "border px-5 py-2 text-[11px] font-bold tracking-[0.15em] uppercase transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-primary/25 text-primary/70 hover:border-primary hover:text-primary",
                    ].join(" ")}
                  >
                    {t.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {courses.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <BookOpen className="text-primary/30 h-12 w-12" />
              <p className="text-muted-foreground mt-4 text-sm">
                No courses available at this time. Check back soon.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course, i) => (
                <Reveal key={course.id} delay={(i % 3) * 80}>
                  <div className="group ring-primary/10 flex h-full flex-col overflow-hidden bg-white shadow-md ring-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
                    {/* Top — image */}
                    <div className="relative h-72 shrink-0">
                      {course.imageUrl &&
                      /^https?:\/\//.test(course.imageUrl) ? (
                        <img
                          src={course.imageUrl}
                          alt={course.title}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div className="bg-primary absolute inset-0 flex items-center justify-center">
                          <span className="text-gold text-5xl font-semibold">
                            {course.title.charAt(0)}
                          </span>
                        </div>
                      )}
                      {/* Type badge on image */}
                      <span
                        className={[
                          "absolute top-3 left-3 px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] uppercase",
                          course.courseType === "ONLINE"
                            ? "bg-primary text-white"
                            : "bg-gold text-primary",
                        ].join(" ")}
                      >
                        {course.courseType === "ONLINE" ? "Online" : "On-Site"}
                      </span>
                      {/* Duration badge */}
                      {course.courseDuration && (
                        <span className="absolute top-3 left-[4.75rem] bg-black/60 px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] text-white uppercase backdrop-blur-sm">
                          {course.courseDuration === "SHORT" ? "Short" : "Long"}
                        </span>
                      )}
                      {/* Gold underline reveal */}
                      <span className="bg-gold absolute inset-x-0 bottom-0 z-10 h-0.5 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100" />
                    </div>

                    {/* Bottom — content */}
                    <div className="flex flex-1 flex-col justify-between p-6">
                      <div>
                        <h3 className="text-primary text-base font-semibold">
                          {course.title}
                        </h3>
                        {course.description && (
                          <p className="text-muted-foreground mt-2 line-clamp-3 text-sm leading-relaxed font-light">
                            {course.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-6">
                        {course.tuitionFee != null ? (
                          <div>
                            <span className="text-primary text-xl font-bold">
                              ₱{course.tuitionFee.toLocaleString("en-PH")}
                            </span>
                            {course.paymentFrequency && (
                              <span className="text-muted-foreground ml-1 text-sm">
                                {priceSuffix(course.paymentFrequency)}
                              </span>
                            )}
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              {course.miscFeeNote ??
                                "Flexible installments available"}
                            </p>
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">
                            Contact us for pricing
                          </p>
                        )}
                        <div className="mt-5 flex flex-col gap-2.5">
                          <Link
                            href={`/courses/${course.id}`}
                            className="border-primary/30 text-primary hover:border-primary hover:bg-primary inline-flex w-full items-center justify-center border px-6 py-2.5 text-[11px] font-bold tracking-[0.15em] uppercase transition-colors hover:text-white"
                          >
                            Learn More
                          </Link>
                          <Link
                            href="/register"
                            className="bg-gold text-primary hover:bg-gold-soft inline-flex w-full items-center justify-center px-6 py-2.5 text-[11px] font-bold tracking-[0.15em] uppercase transition-colors"
                          >
                            Register to Enroll
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Partial Payment Band ── */}
      <section className="bg-primary relative overflow-hidden px-6 py-16">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgba(236,204,105,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(236,204,105,0.04) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />
        <Reveal className="relative mx-auto max-w-2xl text-center">
          <Eyebrow center className="mb-5">
            Flexible Tuition
          </Eyebrow>
          <p className="text-lg leading-relaxed font-light text-white/80">
            All courses support flexible installment payments. Pay a partial
            amount upfront and complete your tuition over time.
          </p>
        </Reveal>
      </section>
    </>
  );
}
