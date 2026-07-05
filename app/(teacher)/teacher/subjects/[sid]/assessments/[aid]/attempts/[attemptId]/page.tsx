import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getAttemptForGrading } from '@/lib/teacher/queries'
import { canManageSubject } from '@/lib/auth/capabilities'
import { getSession } from '@/lib/auth/session'
import { GradingForm } from './grading-form'

type Props = {
  params: Promise<{ sid: string; aid: string; attemptId: string }>
}

export const metadata = { title: 'Grade Submission — AQA Teacher' }

export default async function GradeAttemptPage({ params }: Props) {
  const { sid, aid, attemptId } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const attempt = await getAttemptForGrading(attemptId)
  if (!attempt) notFound()
  if (attempt.subjectId !== sid) notFound()
  if (attempt.assessmentId !== aid) notFound()
  if (!(await canManageSubject(session, sid))) notFound()

  const base = '/teacher/subjects/' + sid

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link
        href={base + '/assessments/' + aid}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Assessment
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Grade Submission</h1>
        <p className="text-muted-foreground mt-1">
          {attempt.studentName} · {attempt.assessmentTitle}
        </p>
      </div>
      <GradingForm attempt={attempt} subjectId={sid} basePath={base} />
    </div>
  )
}
