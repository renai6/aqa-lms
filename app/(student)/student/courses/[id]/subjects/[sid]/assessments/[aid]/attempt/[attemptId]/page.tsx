import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, X, Clock } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { getStudentAttempt } from '@/lib/student/queries'
import { Badge } from '@/components/ui/badge'
import { AttemptForm } from './attempt-form'

type Props = {
  params: Promise<{ id: string; sid: string; aid: string; attemptId: string }>
}

export async function generateMetadata() {
  return { title: 'Attempt — AQA Student' }
}

export default async function AttemptPage({ params }: Props) {
  const { id, sid, aid, attemptId } = await params

  const session = await getSession()
  if (!session) redirect('/login')

  const attempt = await getStudentAttempt(session.userId, attemptId)
  if (
    !attempt ||
    attempt.courseId !== id ||
    attempt.subjectId !== sid ||
    attempt.assessmentId !== aid
  ) {
    notFound()
  }

  const backHref = '/student/courses/' + id + '/subjects/' + sid

  // ── Take mode ──
  if (attempt.status === 'IN_PROGRESS') {
    // Never send the answer key to the client during an in-progress attempt.
    const takeQuestions = attempt.questions.map(q => ({
      id: q.id,
      questionText: q.questionText,
      type: q.type,
      points: q.points,
      order: q.order,
      options: q.options.map(o => ({ id: o.id, label: o.label, value: o.value })),
    }))

    const deadline =
      attempt.durationMins != null
        ? new Date(attempt.startedAt.getTime() + attempt.durationMins * 60_000).toISOString()
        : null

    return (
      <div className="max-w-2xl mx-auto px-6 py-10">
        <AttemptForm
          attemptId={attempt.id}
          assessmentTitle={attempt.assessmentTitle}
          questions={takeQuestions}
          deadline={deadline}
        />
      </div>
    )
  }

  // ── Review mode ──
  const passed =
    attempt.score != null && attempt.passingScore != null
      ? attempt.score >= attempt.passingScore
      : null
  const awaiting = attempt.score == null

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to subject
      </Link>

      {/* Score header */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-2">
        <p className="text-xs uppercase tracking-wide text-zinc-400">{attempt.assessmentTitle}</p>
        {awaiting ? (
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" aria-hidden="true" />
            <span className="text-lg font-semibold text-zinc-700">Awaiting grading</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold">{Math.round(attempt.score!)}%</span>
            {passed != null &&
              (passed ? (
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Pass</Badge>
              ) : (
                <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Fail</Badge>
              ))}
          </div>
        )}
        {attempt.passingScore != null && !awaiting && (
          <p className="text-xs text-zinc-500">Passing score: {attempt.passingScore}%</p>
        )}
        {awaiting && (
          <p className="text-xs text-zinc-500">
            This assessment contains essay questions. Your final score will appear once a teacher
            has graded them.
          </p>
        )}
      </div>

      {/* Per-question breakdown */}
      <div className="space-y-4">
        {attempt.questions.map((q, i) => {
          const correctOption = q.options.find(o => o.isCorrect)
          const isEssay = q.type === 'ESSAY'
          return (
            <div key={q.id} className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">
                  <span className="text-zinc-400">{i + 1}.</span> {q.questionText}
                </p>
                <span className="shrink-0 text-xs text-zinc-400">
                  {isEssay || q.pointsEarned == null
                    ? '— / ' + q.points
                    : q.pointsEarned + ' / ' + q.points}
                </span>
              </div>

              {isEssay ? (
                <div className="space-y-2">
                  <div className="rounded-md bg-zinc-50 border border-zinc-200 p-3 text-sm text-zinc-700 whitespace-pre-wrap">
                    {q.answer && q.answer.length > 0 ? (
                      q.answer
                    ) : (
                      <span className="text-zinc-400">No answer submitted.</span>
                    )}
                  </div>
                  <p className="text-xs text-amber-600">Awaiting grading</p>
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {q.options.map(o => {
                    const isChosen = o.value === q.answer
                    const isRight = o.isCorrect
                    return (
                      <li
                        key={o.id}
                        className={
                          'flex items-center gap-2 rounded-md border px-3 py-2 text-sm ' +
                          (isRight
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : isChosen
                              ? 'border-red-300 bg-red-50 text-red-800'
                              : 'border-zinc-200 text-zinc-600')
                        }
                      >
                        {isRight ? (
                          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                        ) : isChosen ? (
                          <X className="w-4 h-4 shrink-0" aria-hidden="true" />
                        ) : (
                          <span className="w-4 h-4 shrink-0" />
                        )}
                        <span className="flex-1">{o.label}</span>
                        {isChosen && (
                          <span className="text-[10px] uppercase tracking-wide font-semibold opacity-70">
                            Your answer
                          </span>
                        )}
                      </li>
                    )
                  })}
                  {q.answer == null && (
                    <li className="text-xs text-zinc-400 px-1">No answer submitted.</li>
                  )}
                  {correctOption == null && (
                    <li className="text-xs text-zinc-400 px-1">No correct answer configured.</li>
                  )}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
