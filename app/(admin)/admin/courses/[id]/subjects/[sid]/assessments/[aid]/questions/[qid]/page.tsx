import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getQuestionById } from '@/lib/assessments/queries'
import { getSession } from '@/lib/auth/session'
import { QuestionForm } from '@/components/assessments/question-form'

type Props = { params: Promise<{ id: string; sid: string; aid: string; qid: string }> }

export async function generateMetadata({ params }: Props) {
  const { qid } = await params
  const question = await getQuestionById(qid)
  return { title: question ? 'Edit Question — ' + question.assessment.title + ' — AQA Admin' : 'Question — AQA Admin' }
}

export default async function EditQuestionPage({ params }: Props) {
  const { id, sid, aid, qid } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const question = await getQuestionById(qid)
  if (!question) notFound()
  if (question.assessmentId !== aid) notFound()
  if (question.assessment.subjectId !== sid) notFound()
  if (question.assessment.subject.courseId !== id) notFound()

  const locked = question.assessment.attemptCount > 0

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
        <h1 className="text-2xl font-semibold">Edit Question</h1>
        <p className="text-muted-foreground mt-1">
          {question.assessment.subject.course.title} › {question.assessment.subject.title} › {question.assessment.title}
        </p>
      </div>
      <QuestionForm
        assessmentId={aid}
        subjectId={sid}
        basePath={'/admin/courses/' + id + '/subjects/' + sid}
        locked={locked}
        question={question}
      />
    </div>
  )
}
