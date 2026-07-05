import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getAssessmentById } from '@/lib/assessments/queries'
import { getAssessmentGradingQueue } from '@/lib/teacher/queries'
import { canManageSubject } from '@/lib/auth/capabilities'
import { getSession } from '@/lib/auth/session'
import { PageHeader } from '@/components/admin/page-header'
import { AssessmentEditor } from '@/components/assessments/assessment-editor'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Props = { params: Promise<{ sid: string; aid: string }> }

export async function generateMetadata({ params }: Props) {
  const { aid } = await params
  const assessment = await getAssessmentById(aid)
  return {
    title: assessment
      ? assessment.title + ' — AQA Teacher'
      : 'Assessment — AQA Teacher',
  }
}

function statusLabel(status: string): string {
  return status === 'GRADED' ? 'Graded' : 'Needs grading'
}

export default async function TeacherAssessmentPage({ params }: Props) {
  const { sid, aid } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const assessment = await getAssessmentById(aid)
  if (!assessment) notFound()
  if (assessment.subjectId !== sid) notFound()
  if (!(await canManageSubject(session, sid))) notFound()

  const queue = await getAssessmentGradingQueue(aid)
  const base = '/teacher/subjects/' + sid

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        breadcrumbs={[
          { label: 'My Subjects', href: '/teacher/subjects' },
          { label: assessment.subject.title, href: base },
          { label: assessment.title },
        ]}
        title={assessment.title}
      />

      <AssessmentEditor assessment={assessment} basePath={base} />

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Submissions</h2>
          <p className="text-muted-foreground text-sm">
            {queue && queue.hasEssay
              ? 'Essay answers need manual grading. Open a submission to score it.'
              : 'This assessment is auto-graded; submissions are shown for reference.'}
          </p>
        </div>

        {!queue || queue.attempts.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border py-4 text-center text-sm">
            No submissions yet.
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
                    Student
                  </th>
                  <th
                    scope="col"
                    className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                  >
                    Score
                  </th>
                  <th
                    scope="col"
                    className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                  >
                    Submitted
                  </th>
                  <th
                    scope="col"
                    aria-label="Actions"
                    className="px-4 py-3"
                  ></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {queue.attempts.map((a) => (
                  <tr
                    key={a.attemptId}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">{a.studentName}</td>
                    <td className="px-4 py-3">
                      {a.status === 'GRADED' ? (
                        <span className="text-green-600">
                          {statusLabel(a.status)}
                        </span>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-amber-300 bg-amber-50 text-amber-700"
                        >
                          {statusLabel(a.status)}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {a.score == null ? '—' : a.score.toFixed(1) + '%'}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {a.submittedAt ? a.submittedAt.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={
                            base +
                            '/assessments/' +
                            aid +
                            '/attempts/' +
                            a.attemptId
                          }
                        >
                          {a.status === 'GRADED' ? 'Review' : 'Grade'}
                        </Link>
                      </Button>
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
