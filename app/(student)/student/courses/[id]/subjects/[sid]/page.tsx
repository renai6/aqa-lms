// app/(student)/student/courses/[id]/subjects/[sid]/page.tsx
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { getStudentSubject } from '@/lib/student/queries'
import { Badge } from '@/components/ui/badge'
import { LessonDoneButton } from './lesson-done-button'
import { TabSwitcher } from './tab-switcher'

type Props = {
  params: Promise<{ id: string; sid: string }>
  searchParams: Promise<{ tab?: string }>
}

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${mStr} ${period}`
}

const DAY_LABEL: Record<string, string> = {
  MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed',
  THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun',
}

export async function generateMetadata({ params }: Props) {
  await params
  return { title: 'Subject — AQA Student' }
}

export default async function StudentSubjectPage({ params, searchParams }: Props) {
  const { id, sid } = await params
  const { tab: rawTab } = await searchParams
  const activeTab = rawTab === 'assessments' ? 'assessments' : 'lessons'

  const session = await getSession()
  if (!session) redirect('/login')

  const subject = await getStudentSubject(session.userId, sid)
  if (!subject || subject.courseId !== id) notFound()

  return (
    <div className="px-6 md:px-10 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Link
          href={'/student/courses/' + id}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          {subject.course.title}
        </Link>
        <h1 className="text-2xl font-bold">{subject.title}</h1>
        {subject.schedules.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {subject.schedules.map((s, i) => (
              <span key={i} className="text-sm text-muted-foreground">
                {DAY_LABEL[s.day]} {formatTime(s.startTime)}–{formatTime(s.endTime)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <Suspense fallback={null}>
        <TabSwitcher activeTab={activeTab} />
      </Suspense>

      {/* Lessons tab */}
      {activeTab === 'lessons' && (
        <div className="space-y-2">
          {subject.lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No lessons yet.</p>
          ) : (
            <div className="divide-y border rounded-lg overflow-hidden">
              {subject.lessons.map(lesson => (
                <div
                  key={lesson.id}
                  className={
                    'flex items-center justify-between px-4 py-4 gap-4 ' +
                    (lesson.isCompleted ? 'bg-muted/30' : '')
                  }
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className={
                      'font-medium text-sm ' +
                      (lesson.isCompleted ? 'text-muted-foreground line-through' : '')
                    }>
                      {lesson.title}
                    </p>
                    {lesson.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{lesson.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {lesson.materialUrl && (
                        <a
                          href={lesson.materialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          Materials <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      )}
                      {lesson.recordingUrl && (
                        <a
                          href={lesson.recordingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          Recording <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <LessonDoneButton
                      lessonId={lesson.id}
                      subjectId={sid}
                      courseId={id}
                      isCompleted={lesson.isCompleted}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assessments tab */}
      {activeTab === 'assessments' && (
        <div className="space-y-2">
          {subject.assessments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No assessments yet.</p>
          ) : (
            <div className="divide-y border rounded-lg overflow-hidden">
              {subject.assessments.map(assessment => (
                <div key={assessment.id} className="flex items-center justify-between px-4 py-4 gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{assessment.title}</p>
                      <Badge variant="outline" className="text-xs">
                        {assessment.type === 'QUIZ' ? 'Quiz' : 'Exam'}
                      </Badge>
                      {assessment.durationMins && (
                        <span className="text-xs text-muted-foreground">{assessment.durationMins} min</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {assessment.bestScore !== null
                        ? 'Best score: ' + assessment.bestScore.toFixed(1) + '%'
                        : 'Not attempted'}
                      {assessment.maxAttempts !== null && (
                        <span> · {assessment.attemptCount}/{assessment.maxAttempts} attempts used</span>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {/* Assessment taking is out of scope — placeholder */}
                    <span className="text-xs text-muted-foreground italic">Coming soon</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
