import { notFound, redirect } from 'next/navigation'
import { getAssessmentById } from '@/lib/assessments/queries'
import { getSession } from '@/lib/auth/session'
import { PageHeader } from '@/components/admin/page-header'
import { AssessmentEditor } from '@/components/assessments/assessment-editor'

type Props = { params: Promise<{ id: string; sid: string; aid: string }> }

export async function generateMetadata({ params }: Props) {
  const { aid } = await params
  const assessment = await getAssessmentById(aid)
  return { title: assessment ? assessment.title + ' — AQA Admin' : 'Assessment — AQA Admin' }
}

export default async function AssessmentDetailPage({ params }: Props) {
  const { id, sid, aid } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const assessment = await getAssessmentById(aid)
  if (!assessment) notFound()
  if (assessment.subjectId !== sid) notFound()
  if (assessment.subject.courseId !== id) notFound()

  const basePath = '/admin/courses/' + id + '/subjects/' + sid

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Courses', href: '/admin/courses' },
          { label: assessment.subject.course.title, href: '/admin/courses/' + id },
          { label: 'Subjects', href: '/admin/courses/' + id + '/subjects' },
          { label: assessment.subject.title, href: basePath },
          { label: 'Assessments', href: basePath + '/assessments' },
          { label: assessment.title },
        ]}
        title={assessment.title}
      />
      <AssessmentEditor assessment={assessment} basePath={basePath} />
    </div>
  )
}
