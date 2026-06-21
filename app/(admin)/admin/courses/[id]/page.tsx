import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getCourseById } from '@/lib/courses/queries'
import { getSession } from '@/lib/auth/session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EditCourseForm } from './edit-course-form'
import { TogglePublishedButton } from './toggle-published-button'
import { DeleteCourseButton } from './delete-course-button'
import { AddSubjectForm } from './add-subject-form'
import { CourseImageCard } from './course-image-card'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const course = await getCourseById(id)
  return { title: course ? course.title + ' — AQA Admin' : 'Course — AQA Admin' }
}

export default async function CourseDetailPage({ params }: Props) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const course = await getCourseById(id)
  if (!course) notFound()

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <Link
        href="/admin/courses"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to Courses
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{course.title}</h1>
        {course.isPublished ? (
          <Badge className="bg-green-100 text-green-800 border-green-200">Published</Badge>
        ) : (
          <Badge variant="outline">Draft</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EditCourseForm course={course} />
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <TogglePublishedButton courseId={course.id} isPublished={course.isPublished} />
              <DeleteCourseButton courseId={course.id} courseTitle={course.title} />
            </CardContent>
          </Card>
          <CourseImageCard courseId={course.id} imageUrl={course.imageUrl} />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Subjects</h2>
        {course.subjects.length === 0 ? (
          <p className="text-muted-foreground text-sm">No subjects yet. Add the first one below.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th
                    scope="col"
                    className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                  >
                    Order
                  </th>
                  <th
                    scope="col"
                    className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                  >
                    Title
                  </th>
                  <th
                    scope="col"
                    className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                  >
                    Units
                  </th>
                  <th
                    scope="col"
                    className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                  >
                    Lessons
                  </th>
                  <th scope="col" aria-label="Actions" className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {course.subjects.map((subject) => (
                  <tr key={subject.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3">{subject.order}</td>
                    <td className="px-4 py-3 font-medium">{subject.title}</td>
                    <td className="px-4 py-3">{subject.units}</td>
                    <td className="px-4 py-3">{subject._count.lessons}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={'/admin/courses/' + course.id + '/subjects/' + subject.id}
                        className="text-primary hover:underline text-sm"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AddSubjectForm courseId={course.id} nextOrder={course.subjects.length + 1} />
      </div>
    </div>
  )
}
