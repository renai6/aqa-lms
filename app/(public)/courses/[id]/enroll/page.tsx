import { notFound } from 'next/navigation'
import { getPublishedCourseById } from '@/lib/enrollments/queries'
import { EnrollForm } from './enroll-form'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const course = await getPublishedCourseById(id)
  return {
    title: course
      ? `Enroll in ${course.title} — Al-Qur'an Academy`
      : "Enroll — Al-Qur'an Academy",
  }
}

export default async function EnrollPage({ params }: Props) {
  const { id } = await params
  const course = await getPublishedCourseById(id)
  if (!course) notFound()

  const hasImage = !!course.imageUrl && /^https?:\/\//.test(course.imageUrl)

  return (
    <>
      {/* ── Hero Banner ── */}
      <section className="relative bg-zinc-900 min-h-[max(40vh,320px)] flex items-center pt-20 pb-24">
        {/* Course image background */}
        {hasImage && (
          <img
            src={course.imageUrl!}
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {/* Dark overlay — always rendered so text stays readable */}
        <div className="absolute inset-0 bg-black/60" />

        {/* Grain texture */}
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full opacity-[0.04] pointer-events-none mix-blend-overlay"
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="grain-enroll-hero">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-enroll-hero)" />
        </svg>

        {/* Crimson radial glow */}
        <div
          className="absolute top-0 left-0 w-96 h-96 rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, oklch(0.525 0.223 3.958 / 0.2) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 max-w-lg mx-auto w-full px-4 sm:px-6">
          <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Enrollment Application
          </span>
          <h1 className="mt-4 text-4xl sm:text-5xl font-bold text-white tracking-tight">
            Enroll in {course.title}
          </h1>
          <p className="mt-3 text-base text-white/70 max-w-xl">
            Complete the form below to submit your enrollment application. You&apos;ll receive a
            confirmation email once submitted.
          </p>
        </div>
      </section>

      {/* ── Form Section ── */}
      <section className="bg-background">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-12">
          <EnrollForm
            courseId={course.id}
            courseTitle={course.title}
            tuitionFee={course.tuitionFee}
          />
        </div>
      </section>

      {/* ── Footer Band ── */}
      <section className="bg-zinc-900 py-10 px-4">
        <p className="mx-auto max-w-xl text-center text-sm text-white/70">
          Your application will be reviewed by our team within 1–2 business days. You&apos;ll
          receive an email update at the address you provided.
        </p>
      </section>
    </>
  )
}
