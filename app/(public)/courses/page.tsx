import Link from 'next/link'
import { getPublishedCourses } from '@/lib/enrollments/queries'

export const metadata = { title: "Courses — Al-Qur'an Academy" }

export default async function CoursesPage() {
  const courses = await getPublishedCourses()

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Courses</h1>
        <p className="text-muted-foreground mt-2">
          Browse our available courses and apply for enrollment.
        </p>
      </div>

      {courses.length === 0 ? (
        <p className="text-muted-foreground">No courses available at this time.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <div key={course.id} className="border rounded-lg p-6 space-y-4 flex flex-col">
              <div className="flex-1 space-y-2">
                <h2 className="text-lg font-semibold">{course.title}</h2>
                {course.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {course.description}
                  </p>
                )}
              </div>
              <Link
                href={`/courses/${course.id}/enroll`}
                className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Enroll Now
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
