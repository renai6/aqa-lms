import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { getPublishedCourses } from '@/lib/courses/queries'

export const metadata = { title: "Courses — Al-Qur'an Academy" }

export default async function CoursesPage() {
  const courses = await getPublishedCourses()

  return (
    <>
      {/* ── Hero Banner ── */}
      <section
        className="relative bg-zinc-900 min-h-[40vh] flex items-center pt-20 pb-24"
        style={{ clipPath: 'polygon(0 0, 100% 0, 100% 88%, 0 100%)' }}
      >
        {/* Grain texture */}
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full opacity-[0.04] pointer-events-none mix-blend-overlay"
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
          className="absolute top-0 left-0 w-96 h-96 rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, oklch(0.525 0.223 3.958 / 0.2) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 max-w-5xl mx-auto w-full px-4 sm:px-6">
          <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Enrollment Open
          </span>
          <h1 className="mt-4 text-4xl sm:text-5xl font-bold text-white tracking-tight">
            Explore Our Courses
          </h1>
          <p className="mt-3 text-base text-white/70 max-w-xl">
            Guided by the Saudi Ministry curriculum — online and face-to-face
            programs for every learner.
          </p>
        </div>
      </section>

      {/* ── Course List or Empty State ── */}
      {courses.length === 0 ? (
        <section className="bg-background py-24 px-4">
          <div className="flex flex-col items-center text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground/40" />
            <p className="mt-4 text-sm text-muted-foreground">
              No courses available at this time. Check back soon.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="bg-background">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 space-y-6">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="flex flex-col sm:flex-row rounded-xl border shadow-md overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                >
                  {/* Left panel — image */}
                  <div className="relative sm:w-2/5 shrink-0 min-h-[200px]">
                    {course.imageUrl && /^https?:\/\//.test(course.imageUrl) ? (
                      <img
                        src={course.imageUrl}
                        alt={course.title}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                        <span className="text-5xl font-bold text-primary">
                          {course.title.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right panel — content */}
                  <div className="flex flex-1 flex-col justify-between p-6 sm:p-8">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">
                        {course.title}
                      </h2>
                      {course.description && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                          {course.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-6">
                      {course.tuitionFee != null ? (
                        <div>
                          <span className="text-lg font-bold text-foreground">
                            ₱{course.tuitionFee.toLocaleString('en-PH')}
                          </span>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Flexible installments available
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Contact us for pricing
                        </p>
                      )}
                      <Link
                        href="/register"
                        className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        Register to purchase
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Partial Payment Band ── */}
          <section className="bg-zinc-900 py-10 px-4">
            <p className="mx-auto max-w-xl text-center text-sm text-white/70">
              All courses support flexible installment payments. Pay a partial
              amount upfront and complete your tuition over time.
            </p>
          </section>
        </>
      )}
    </>
  )
}
