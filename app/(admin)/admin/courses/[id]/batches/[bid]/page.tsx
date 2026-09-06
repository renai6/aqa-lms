import { notFound, redirect } from 'next/navigation'
import { getBatchDetail, batchLabel } from '@/lib/batches/queries'
import { getCourseById } from '@/lib/courses/queries'
import { getSession } from '@/lib/auth/session'
import { PageHeader } from '@/components/admin/page-header'
import { Badge } from '@/components/ui/badge'
import { BatchLessonForm } from './batch-lesson-form'
import { BatchSubjectCard } from './batch-subject-card'
import { BatchRecordingsPanel } from './batch-recordings-panel'

type Props = { params: Promise<{ id: string; bid: string }> }

export async function generateMetadata({ params }: Props) {
  const { bid } = await params
  const batch = await getBatchDetail(bid)
  return { title: batch ? batchLabel(batch) + ' — AQA Admin' : 'Batch — AQA Admin' }
}

export default async function BatchDetailPage({ params }: Props) {
  const { id, bid } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const [course, batch] = await Promise.all([getCourseById(id), getBatchDetail(bid)])
  if (!course || !batch || batch.courseId !== id) notFound()

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Courses', href: '/admin/courses' },
          { label: course.title, href: '/admin/courses/' + id },
          { label: 'Batches', href: '/admin/courses/' + id + '/batches' },
          { label: batchLabel(batch) },
        ]}
        title={batchLabel(batch)}
        action={
          batch.isActive
            ? <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>
            : <Badge variant="outline">Inactive</Badge>
        }
      />

      <p className="text-sm text-muted-foreground">
        {batch._count.enrollments} student{batch._count.enrollments !== 1 ? 's' : ''} enrolled in this batch
      </p>

      <div className="space-y-4">
        {batch.course.subjects.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8 border rounded-lg">
            No subjects in this course yet.
          </p>
        )}
        {batch.course.subjects.map((subject) => (
          <BatchSubjectCard key={subject.id} title={subject.title}>
            {subject.lessons.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lessons in this subject.</p>
            ) : (
              <div>
                {subject.lessons.map((lesson) => {
                  const content = lesson.batchContent[0] ?? null
                  return (
                    <BatchLessonForm
                      key={lesson.id}
                      batchId={bid}
                      courseId={id}
                      lessonId={lesson.id}
                      lessonTitle={lesson.title}
                      lessonOrder={lesson.order}
                      materialUrl={content?.materialUrl ?? null}
                      videoUrl={content?.videoUrl ?? null}
                      audioUrl={content?.audioUrl ?? null}
                      pptUrl={content?.pptUrl ?? null}
                    />
                  )
                })}
              </div>
            )}
            <BatchRecordingsPanel
              batchId={bid}
              courseId={id}
              subjectId={subject.id}
              recordings={subject.recordings}
            />
          </BatchSubjectCard>
        ))}
      </div>
    </div>
  )
}
