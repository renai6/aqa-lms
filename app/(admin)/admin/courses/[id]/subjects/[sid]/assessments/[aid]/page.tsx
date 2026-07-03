import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getAssessmentById } from '@/lib/assessments/queries'
import { getPublishBlockers } from '@/lib/assessments/publish-validation'
import { getSession } from '@/lib/auth/session'
import { PageHeader } from '@/components/admin/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EditAssessmentForm } from './edit-assessment-form'
import { PublishPanel } from './publish-panel'
import { DeleteAssessmentButton } from './delete-assessment-button'
import { QuestionRowActions } from './question-row-actions'

type Props = { params: Promise<{ id: string; sid: string; aid: string }> }

export async function generateMetadata({ params }: Props) {
  const { aid } = await params
  const assessment = await getAssessmentById(aid)
  return { title: assessment ? assessment.title + ' — AQA Admin' : 'Assessment — AQA Admin' }
}

function correctAnswerSummary(q: { type: string; options: { label: string; isCorrect: boolean }[] }): string {
  if (q.type === 'ESSAY') return 'Manual'
  const correct = q.options.find(o => o.isCorrect)
  return correct ? correct.label : '—'
}

export default async function AssessmentDetailPage({ params }: Props) {
  const { id, sid, aid } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const assessment = await getAssessmentById(aid)
  if (!assessment) notFound()
  if (assessment.subjectId !== sid) notFound()
  if (assessment.subject.courseId !== id) notFound()

  const locked = assessment.attemptCount > 0
  const blockers = getPublishBlockers(assessment.questions)
  const totalPoints = assessment.questions.reduce((s, q) => s + q.points, 0)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Courses', href: '/admin/courses' },
          { label: assessment.subject.course.title, href: '/admin/courses/' + id },
          { label: 'Subjects', href: '/admin/courses/' + id + '/subjects' },
          { label: assessment.subject.title, href: '/admin/courses/' + id + '/subjects/' + sid },
          { label: 'Assessments', href: '/admin/courses/' + id + '/subjects/' + sid + '/assessments' },
          { label: assessment.title },
        ]}
        title={assessment.title}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <EditAssessmentForm assessment={assessment} />
        </div>
        <div className="space-y-4">
          <PublishPanel
            assessmentId={aid}
            subjectId={sid}
            courseId={id}
            isPublished={assessment.isPublished}
            blockers={blockers}
          />
          <DeleteAssessmentButton
            assessmentId={aid}
            subjectId={sid}
            courseId={id}
            assessmentTitle={assessment.title}
            attemptCount={assessment.attemptCount}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Questions</h2>
            <p className="text-sm text-muted-foreground">Total: {totalPoints} pts</p>
          </div>
          <div className="flex items-center gap-2">
            {locked && (
              <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                Locked
              </Badge>
            )}
            <Button asChild size="sm" disabled={locked}>
              {locked ? (
                <span>New Question</span>
              ) : (
                <Link href={'/admin/courses/' + id + '/subjects/' + sid + '/assessments/' + aid + '/questions/new'}>
                  New Question
                </Link>
              )}
            </Button>
          </div>
        </div>

        {assessment.questions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
            No questions yet.
          </p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Order</th>
                  <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Question</th>
                  <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Type</th>
                  <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Pts</th>
                  <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Correct</th>
                  <th scope="col" aria-label="Actions" className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {assessment.questions.map((q, i) => (
                  <tr key={q.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3">{q.order}</td>
                    <td className="px-4 py-3 max-w-xs">
                      <Link
                        href={'/admin/courses/' + id + '/subjects/' + sid + '/assessments/' + aid + '/questions/' + q.id}
                        className="hover:underline text-primary"
                      >
                        {q.questionText.length > 70 ? q.questionText.slice(0, 70) + '…' : q.questionText}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">
                        {q.type === 'MULTIPLE_CHOICE' ? 'MC' : q.type === 'TRUE_FALSE' ? 'TF' : 'Essay'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{q.points}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {correctAnswerSummary(q)}
                    </td>
                    <td className="px-4 py-3">
                      <QuestionRowActions
                        questionId={q.id}
                        assessmentId={aid}
                        subjectId={sid}
                        courseId={id}
                        questionText={q.questionText}
                        isFirst={i === 0}
                        isLast={i === assessment.questions.length - 1}
                        locked={locked}
                      />
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
