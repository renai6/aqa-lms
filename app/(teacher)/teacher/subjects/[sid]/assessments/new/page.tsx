import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { getTeacherSubject } from '@/lib/teacher/queries'
import { CreateAssessmentForm } from '@/components/assessments/create-assessment-form'

type Props = { params: Promise<{ sid: string }> }

export const metadata = { title: 'New Assessment — AQA Teacher' }

export default async function NewTeacherAssessmentPage({ params }: Props) {
  const { sid } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const subject = await getTeacherSubject(session.userId, sid)
  if (!subject) notFound()

  const base = '/teacher/subjects/' + sid

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <Link
        href={base}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Subject
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">New Assessment</h1>
        <p className="text-muted-foreground mt-1">
          {subject.courseTitle} › {subject.title}
        </p>
      </div>
      <CreateAssessmentForm subjectId={sid} basePath={base} />
    </div>
  )
}
