import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import {
  getTeacherSubject,
  getTeacherSubjectRecordings,
} from '@/lib/teacher/queries'
import { PageHeader } from '@/components/admin/page-header'
import { SubjectTabs } from '../subject-tabs'
import { RecordingsViewer } from './recordings-viewer'

type Props = { params: Promise<{ sid: string }> }

export const metadata = { title: 'Recordings — AQA Teacher' }

export default async function TeacherSubjectRecordingsPage({ params }: Props) {
  const { sid } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const [subject, batches] = await Promise.all([
    getTeacherSubject(session.userId, sid),
    getTeacherSubjectRecordings(session.userId, sid),
  ])
  if (!subject || !batches) notFound()

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        breadcrumbs={[
          { label: 'My Subjects', href: '/teacher/subjects' },
          { label: subject.courseTitle },
          { label: subject.title },
        ]}
        title={subject.title}
      />
      <SubjectTabs subjectId={sid} />

      {batches.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border py-8 text-center text-sm">
          No recordings for this subject yet.
        </p>
      ) : (
        <RecordingsViewer batches={batches} />
      )}
    </div>
  )
}
