import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, X, Clock } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { getStudentAttempt } from '@/lib/student/queries'
import { Badge } from '@/components/ui/badge'
import { AttemptForm } from './attempt-form'
import { RetakeButton } from './retake-button'

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
      mediaType: q.mediaType,
      mediaUrl: q.mediaUrl,
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
      <div className="rounded-xl border border-border bg-white p-6 space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{attempt.assessmentTitle}</p>
        {awaiting ? (
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" aria-hidden="true" />
            <span className="text-lg font-semibold text-foreground">Awaiting grading</span>
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
          <p className="text-xs text-muted-foreground">Passing score: {attempt.passingScore}%</p>
        )}
        {awaiting && (
          <p className="text-xs text-muted-foreground">
            This assessment contains essay questions. Your final score will appear once a teacher
            has graded them.
          </p>
        )}
      </div>

      {/* Gate result panel */}
      {attempt.isGate && (
        attempt.passed ? (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-800">You passed.</p>
            <p className="text-xs text-emerald-700">The next lesson is now open.</p>
            <Link
              href={backHref}
              className="mt-2 inline-block text-xs font-semibold text-emerald-800 underline"
            >
              Back to {attempt.subjectTitle}
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              Not passed yet - you need {attempt.passingScore}%.
            </p>
            <p className="text-xs text-amber-800">
              You can retake this quiz as many times as you need.
            </p>
            <RetakeButton
              assessmentId={attempt.assessmentId}
              courseId={attempt.courseId}
              subjectId={attempt.subjectId}
            />
          </div>
        )
      )}

      {/* Per-question breakdown */}
      <div className="space-y-4">
        {attempt.questions.map((q, i) => {
          const correctOption = q.options.find(o => o.isCorrect)
          const keyWithheld = correctOption == null && q.options.some(o => o.isCorrect === null)
          const isEssay = q.type === 'ESSAY'
          return (
            <div key={q.id} className="rounded-xl border border-border bg-white p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">
                  <span className="text-muted-foreground">{i + 1}.</span> {q.questionText}
                </p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {isEssay || q.pointsEarned == null
                    ? '— / ' + q.points
                    : q.pointsEarned + ' / ' + q.points}
                </span>
              </div>

              {isEssay ? (
                <div className="space-y-2">
                  <div className="rounded-md bg-muted/60 border border-border p-3 text-sm text-foreground whitespace-pre-wrap">
                    {q.answer && q.answer.length > 0 ? (
                      q.answer
                    ) : (
                      <span className="text-muted-foreground">No answer submitted.</span>
                    )}
                  </div>
                  <p className="text-xs text-amber-600">Awaiting grading</p>
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {q.options.map(o => {
                    const isChosen = o.value === q.answer
                    const isRight = o.isCorrect === true
                    // With the key withheld every o.isCorrect is null, so isRight
                    // is always false here - only the student's own chosen option
                    // gets coloured, using their answer's own correctness.
                    const isWrong = keyWithheld
                      ? isChosen && q.isCorrect === false
                      : isChosen && !isRight
                    const isRightChosen = keyWithheld ? isChosen && q.isCorrect === true : isRight
                    return (
                      <li
                        key={o.id}
                        className={
                          'flex items-center gap-2 rounded-md border px-3 py-2 text-sm ' +
                          (isRightChosen
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : isWrong
                              ? 'border-red-300 bg-red-50 text-red-800'
                              : 'border-border text-muted-foreground')
                        }
                      >
                        {isRightChosen ? (
                          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                        ) : isWrong ? (
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
                    <li className="text-xs text-muted-foreground px-1">No answer submitted.</li>
                  )}
                  {keyWithheld && (
                    <li className="text-xs text-muted-foreground px-1">
                      Correct answers are hidden until you pass. Review the lesson and try again.
                    </li>
                  )}
                  {correctOption == null && !keyWithheld && (
                    <li className="text-xs text-muted-foreground px-1">No correct answer configured.</li>
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
