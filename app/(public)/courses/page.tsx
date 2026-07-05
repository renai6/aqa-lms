import Link from "next/link";
import { BookOpen } from "lucide-react";
import { getPublishedCourses } from "@/lib/courses/queries";
import type { CourseType } from "@prisma/client";

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
      <section
        className="relative flex min-h-[40vh] items-center bg-zinc-900 pt-20 pb-24"
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 88%, 0 100%)" }}
      >
        {/* Grain texture */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.04] mix-blend-overlay"
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="grain-courses-hero">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-courses-hero)" />
        </svg>

        {/* Crimson radial glow */}
        <div
          className="pointer-events-none absolute top-0 left-0 h-96 w-96 rounded-full"
          style={{
            background:
              "radial-gradient(circle, oklch(0.525 0.223 3.958 / 0.2) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 mx-auto w-full max-w-5xl px-4 sm:px-6">
          <span className="border-primary/20 bg-primary/10 text-primary inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold">
            Enrollment Open
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Explore Our Courses
          </h1>
          <p className="mt-3 max-w-xl text-base text-white/70">
            Guided by the Saudi Ministry curriculum — online and face-to-face
            programs for every learner.
          </p>
        </div>
      </section>

      {/* ── Course List or Empty State ── */}
      <section className="bg-background">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          {/* Filter tabs */}
          <div className="mb-8 flex gap-2">
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
                    "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  ].join(" ")}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>

          {courses.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <BookOpen className="text-muted-foreground/40 h-12 w-12" />
              <p className="text-muted-foreground mt-4 text-sm">
                No courses available at this time. Check back soon.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="flex flex-col overflow-hidden rounded-xl border shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                >
                  {/* Top — image */}
                  <div className="relative h-72 shrink-0">
                    {course.imageUrl && /^https?:\/\//.test(course.imageUrl) ? (
                      <img
                        src={course.imageUrl}
                        alt={course.title}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                        <span className="text-primary text-5xl font-bold">
                          {course.title.charAt(0)}
                        </span>
                      </div>
                    )}
                    {/* Type badge on image */}
                    <span
                      className={[
                        "absolute top-2 left-2 rounded-full px-2 py-0.5 text-[14px] font-bold",
                        course.courseType === "ONLINE"
                          ? "bg-blue-600 text-white"
                          : "bg-amber-600 text-white",
                      ].join(" ")}
                    >
                      {course.courseType === "ONLINE" ? "Online" : "On-Site"}
                    </span>
                    {/* Duration badge */}
                    {course.courseDuration && (
                      <span className="absolute top-2 left-16 rounded-full bg-zinc-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        {course.courseDuration === "SHORT" ? "Short" : "Long"}
                      </span>
                    )}
                  </div>

                  {/* Bottom — content */}
                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div>
                      <h2 className="text-foreground text-base font-semibold">
                        {course.title}
                      </h2>
                      {course.description && (
                        <p className="text-muted-foreground mt-2 line-clamp-3 text-sm">
                          {course.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-5">
                      {course.tuitionFee != null ? (
                        <div>
                          <span className="text-foreground text-lg font-bold">
                            ₱{course.tuitionFee.toLocaleString("en-PH")}
                          </span>
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            Flexible installments available
                          </p>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">
                          Contact us for pricing
                        </p>
                      )}
                      <div className="mt-4 flex flex-col gap-2">
                        <Link
                          href={`/courses/${course.id}`}
                          className="border-primary text-primary hover:bg-primary/10 inline-flex w-full items-center justify-center rounded-full border px-6 py-2.5 text-sm font-semibold transition-colors"
                        >
                          Learn More
                        </Link>
                        <Link
                          href="/register"
                          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex w-full items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold transition-colors"
                        >
                          Register to Enroll
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Partial Payment Band ── */}
      <section className="bg-zinc-900 px-4 py-10">
        <p className="mx-auto max-w-xl text-center text-sm text-white/70">
          All courses support flexible installment payments. Pay a partial
          amount upfront and complete your tuition over time.
        </p>
      </section>
    </>
  );
}
