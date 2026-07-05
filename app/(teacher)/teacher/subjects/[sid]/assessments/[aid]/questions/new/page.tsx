import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getAssessmentById } from '@/lib/assessments/queries'
import { canManageSubject } from '@/lib/auth/capabilities'
import { getSession } from '@/lib/auth/session'
import { QuestionForm } from '@/components/assessments/question-form'

type Props = { params: Promise<{ sid: string; aid: string }> }

export const metadata = { title: 'New Question — AQA Teacher' }

export default async function NewTeacherQuestionPage({ params }: Props) {
  const { sid, aid } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const assessment = await getAssessmentById(aid)
  if (!assessment) notFound()
  if (assessment.subjectId !== sid) notFound()
  if (!(await canManageSubject(session, sid))) notFound()

  const base = '/teacher/subjects/' + sid
  const locked = assessment.attemptCount > 0

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <Link
        href={base + '/assessments/' + aid}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Assessment
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">New Question</h1>
        <p className="text-muted-foreground mt-1">
          {assessment.subject.title} › {assessment.title}
        </p>
      </div>
      <QuestionForm
        assessmentId={aid}
        subjectId={sid}
        basePath={base}
        locked={locked}
      />
    </div>
  )
}
