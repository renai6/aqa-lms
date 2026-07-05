import Link from 'next/link'
import { getPublishBlockers } from '@/lib/assessments/publish-validation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EditAssessmentForm } from './edit-assessment-form'
import { PublishPanel } from './publish-panel'
import { DeleteAssessmentButton } from './delete-assessment-button'
import { QuestionRowActions } from './question-row-actions'
import type { AssessmentDetail } from '@/lib/assessments/queries'

function correctAnswerSummary(q: {
  type: string
  options: { label: string; isCorrect: boolean }[]
}): string {
  if (q.type === 'ESSAY') return 'Manual'
  const correct = q.options.find((o) => o.isCorrect)
  return correct ? correct.label : '—'
}

// Shared assessment authoring body (settings + publish + delete + questions
// table). Rendered by both the admin and teacher assessment detail pages; the
// page owns its own PageHeader/breadcrumbs. All links and actions are driven by
// `basePath` (e.g. `/admin/courses/<cid>/subjects/<sid>` or `/teacher/subjects/<sid>`).
export function AssessmentEditor({
  assessment,
  basePath,
}: {
  assessment: AssessmentDetail
  basePath: string
}) {
  const locked = assessment.attemptCount > 0
  const blockers = getPublishBlockers(assessment.questions)
  const totalPoints = assessment.questions.reduce((s, q) => s + q.points, 0)
  const assessmentBase = basePath + '/assessments/' + assessment.id

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <EditAssessmentForm assessment={assessment} basePath={basePath} />
        </div>
        <div className="space-y-4">
          <PublishPanel
            assessmentId={assessment.id}
            subjectId={assessment.subjectId}
            basePath={basePath}
            isPublished={assessment.isPublished}
            blockers={blockers}
          />
          <DeleteAssessmentButton
            assessmentId={assessment.id}
            subjectId={assessment.subjectId}
            basePath={basePath}
            assessmentTitle={assessment.title}
            attemptCount={assessment.attemptCount}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Questions</h2>
            <p className="text-muted-foreground text-sm">
              Total: {totalPoints} pts
            </p>
          </div>
          <div className="flex items-center gap-2">
            {locked && (
              <Badge
                variant="outline"
                className="border-amber-300 bg-amber-50 text-amber-700"
              >
                Locked
              </Badge>
            )}
            <Button asChild size="sm" disabled={locked}>
              {locked ? (
                <span>New Question</span>
              ) : (
                <Link href={assessmentBase + '/questions/new'}>
                  New Question
                </Link>
              )}
            </Button>
          </div>
        </div>

        {assessment.questions.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border py-4 text-center text-sm">
            No questions yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th
                    scope="col"
                    className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                  >
                    Order
                  </th>
                  <th
                    scope="col"
                    className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                  >
                    Question
                  </th>
                  <th
                    scope="col"
                    className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                  >
                    Type
                  </th>
                  <th
                    scope="col"
                    className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                  >
                    Pts
                  </th>
                  <th
                    scope="col"
                    className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                  >
                    Correct
                  </th>
                  <th
                    scope="col"
                    aria-label="Actions"
                    className="px-4 py-3"
                  ></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {assessment.questions.map((q, i) => (
                  <tr
                    key={q.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-3">{q.order}</td>
                    <td className="max-w-xs px-4 py-3">
                      <Link
                        href={assessmentBase + '/questions/' + q.id}
                        className="text-primary hover:underline"
                      >
                        {q.questionText.length > 70
                          ? q.questionText.slice(0, 70) + '…'
                          : q.questionText}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">
                        {q.type === 'MULTIPLE_CHOICE'
                          ? 'MC'
                          : q.type === 'TRUE_FALSE'
                            ? 'TF'
                            : 'Essay'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{q.points}</td>
                    <td className="text-muted-foreground px-4 py-3">
                      {correctAnswerSummary(q)}
                    </td>
                    <td className="px-4 py-3">
                      <QuestionRowActions
                        questionId={q.id}
                        assessmentId={assessment.id}
                        subjectId={assessment.subjectId}
                        basePath={basePath}
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
    </>
  )
}
