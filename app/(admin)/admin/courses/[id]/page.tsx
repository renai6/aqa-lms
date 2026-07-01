import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getCourseById } from '@/lib/courses/queries'
import { getActiveBatch } from '@/lib/batches/queries'
import { PageHeader } from '@/components/admin/page-header'
import { getSession } from '@/lib/auth/session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'
import { EditCourseForm } from './edit-course-form'
import { TogglePublishedButton } from './toggle-published-button'
import { DeleteCourseButton } from './delete-course-button'
import { CourseImageCard } from './course-image-card'
import { StartBatchButton } from './start-batch-button'

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

  const activeBatch = await getActiveBatch(course.id)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Courses', href: '/admin/courses' },
          { label: course.title },
        ]}
        title={course.title}
        action={
          course.isPublished
            ? <Badge className="bg-green-100 text-green-800 border-green-200">Published</Badge>
            : <Badge variant="outline">Draft</Badge>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EditCourseForm course={course} />
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <TogglePublishedButton courseId={course.id} isPublished={course.isPublished} />
            </CardContent>
          </Card>
          <CourseImageCard courseId={course.id} imageUrl={course.imageUrl} />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-sm">
                Batches
                {activeBatch
                  ? <Badge variant="outline">Batch {activeBatch.number}</Badge>
                  : <Badge variant="destructive" className="text-xs">No Active Batch</Badge>
                }
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!activeBatch && (
                <p className="text-xs text-destructive">
                  New enrollments will have no batch until you start one.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <StartBatchButton courseId={course.id} />
                <Button asChild variant="ghost" size="sm">
                  <Link href={'/admin/courses/' + course.id + '/batches'}>View all batches</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-destructive text-sm">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <DeleteCourseButton courseId={course.id} courseTitle={course.title} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Subjects</h2>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={'/admin/courses/' + course.id + '/subjects'}>Manage all</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={'/admin/courses/' + course.id + '/subjects/new'}>New Subject</Link>
            </Button>
          </div>
        </div>

        {course.subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
            No subjects yet.
          </p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Order</th>
                  <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Title</th>
                  <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Units</th>
                  <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Lessons</th>
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
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={'/admin/courses/' + course.id + '/subjects/' + subject.id}>
                          View <ChevronRight className="w-3 h-3 ml-1" aria-hidden="true" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
