import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getAssessmentById } from '@/lib/assessments/queries'
import { getSession } from '@/lib/auth/session'
import { QuestionForm } from '@/components/assessments/question-form'

type Props = { params: Promise<{ id: string; sid: string; aid: string }> }

export async function generateMetadata({ params }: Props) {
  const { aid } = await params
  const assessment = await getAssessmentById(aid)
  return { title: assessment ? 'New Question — ' + assessment.title + ' — AQA Admin' : 'New Question — AQA Admin' }
}

export default async function NewQuestionPage({ params }: Props) {
  const { id, sid, aid } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const assessment = await getAssessmentById(aid)
  if (!assessment) notFound()
  if (assessment.subjectId !== sid) notFound()
  if (assessment.subject.courseId !== id) notFound()

  const locked = assessment.attemptCount > 0

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Link
        href={'/admin/courses/' + id + '/subjects/' + sid + '/assessments/' + aid}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to Assessment
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">New Question</h1>
        <p className="text-muted-foreground mt-1">
          {assessment.subject.course.title} › {assessment.subject.title} › {assessment.title}
        </p>
      </div>
      <QuestionForm
        assessmentId={aid}
        subjectId={sid}
        basePath={'/admin/courses/' + id + '/subjects/' + sid}
        locked={locked}
      />
    </div>
  )
}
