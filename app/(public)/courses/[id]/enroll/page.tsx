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

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-2">Enrollment Application</h1>
      <p className="text-muted-foreground mb-8">
        Fill in your details below to apply for enrollment.
      </p>
      <EnrollForm courseId={course.id} courseTitle={course.title} tuitionFee={course.tuitionFee} />
    </div>
  )
}
