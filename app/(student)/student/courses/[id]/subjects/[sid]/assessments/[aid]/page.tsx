import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, ListChecks, Target } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { getStudentAssessmentLaunch } from '@/lib/student/queries'
import { Badge } from '@/components/ui/badge'
import { StartAttemptButton } from './start-attempt-button'

type Props = {
  params: Promise<{ id: string; sid: string; aid: string }>
}

export async function generateMetadata() {
  return { title: 'Assessment — AQA Student' }
}

export default async function AssessmentLaunchPage({ params }: Props) {
  const { id, sid, aid } = await params

  const session = await getSession()
  if (!session) redirect('/login')

  const assessment = await getStudentAssessmentLaunch(session.userId, aid)
  if (!assessment || assessment.courseId !== id || assessment.subjectId !== sid) notFound()

  const attempt = assessment.attempt
  const isCompleted = attempt != null && attempt.status !== 'IN_PROGRESS'
  const isInProgress = attempt != null && attempt.status === 'IN_PROGRESS'

  const attemptHref =
    attempt != null
      ? `/student/courses/${id}/subjects/${sid}/assessments/${aid}/attempt/${attempt.id}`
      : null

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <Link
        href={'/student/courses/' + id + '/subjects/' + sid}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to subject
      </Link>

      <div className="space-y-3">
        <Badge variant="secondary" className="uppercase tracking-wide text-[10px]">
          {assessment.type}
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight">{assessment.title}</h1>
        <p className="text-sm text-muted-foreground">{assessment.subjectTitle}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-1">
          <ListChecks className="w-4 h-4 text-zinc-400" aria-hidden="true" />
          <p className="text-lg font-semibold">{assessment.questionCount}</p>
          <p className="text-xs text-zinc-500">Questions</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-1">
          <Clock className="w-4 h-4 text-zinc-400" aria-hidden="true" />
          <p className="text-lg font-semibold">
            {assessment.durationMins != null ? assessment.durationMins + ' min' : 'Untimed'}
          </p>
          <p className="text-xs text-zinc-500">Duration</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-1">
          <Target className="w-4 h-4 text-zinc-400" aria-hidden="true" />
          <p className="text-lg font-semibold">
            {assessment.passingScore != null ? assessment.passingScore + '%' : '—'}
          </p>
          <p className="text-xs text-zinc-500">Passing score</p>
        </div>
      </div>

      {isCompleted ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-700">Your result</p>
            <span className="text-sm font-semibold">
              {attempt!.score != null ? Math.round(attempt!.score) + '%' : 'Awaiting grading'}
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            You have used your attempt for this assessment.
          </p>
          {attemptHref && (
            <Link
              href={attemptHref}
              className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              Review answers
            </Link>
          )}
        </div>
      ) : assessment.questionCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          This assessment has no questions yet.
        </p>
      ) : (
        <div className="space-y-3">
          {assessment.durationMins != null && (
            <p className="text-sm text-muted-foreground">
              Once you start, the {assessment.durationMins}-minute timer begins and cannot be
              paused. You get one attempt.
            </p>
          )}
          <StartAttemptButton
            assessmentId={aid}
            courseId={id}
            subjectId={sid}
            resume={isInProgress}
          />
        </div>
      )}
    </div>
  )
}
