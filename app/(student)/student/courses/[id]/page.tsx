// app/(student)/student/courses/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { getStudentCourse } from '@/lib/student/queries'

type Props = { params: Promise<{ id: string }> }

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
  const { id } = await params
  return { title: 'Course — AQA Student' }
}

export default async function StudentCoursePage({ params }: Props) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const course = await getStudentCourse(session.userId, id)
  if (!course) notFound()

  const pct = course.totalLessons > 0
    ? Math.round((course.completedLessons / course.totalLessons) * 100)
    : 0

  const hasTeachers = course.subjects.some(s => s.teachers.length > 0)

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <Link
          href="/student/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Dashboard
        </Link>
        {course.imageUrl && (
          <div className="relative h-40 w-full overflow-hidden rounded-xl">
            <Image src={course.imageUrl} alt={course.title} fill className="object-cover" />
          </div>
        )}
        <h1 className="text-2xl font-bold">{course.title}</h1>
      </div>

      {/* Overall progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Overall Progress</span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: pct + '%' }} />
        </div>
        <p className="text-xs text-muted-foreground">
          {course.completedLessons} of {course.totalLessons} lessons completed
        </p>
      </div>

      {/* Subjects */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Subjects</h2>
        {course.subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subjects available yet.</p>
        ) : (
          <div className="divide-y border rounded-lg overflow-hidden">
            {course.subjects.map(subject => {
              const subPct = subject.totalLessons > 0
                ? Math.round((subject.completedLessons / subject.totalLessons) * 100)
                : 0
              return (
                <Link
                  key={subject.id}
                  href={'/student/courses/' + id + '/subjects/' + subject.id}
                  className="flex items-center justify-between px-4 py-4 hover:bg-muted/50 transition-colors group"
                >
                  <div className="space-y-1 flex-1 min-w-0 pr-4">
                    <p className="font-medium text-sm group-hover:text-primary transition-colors">
                      {subject.title}
                    </p>
                    {subject.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{subject.description}</p>
                    )}
                    {subject.schedules.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {subject.schedules.map((s, i) => (
                          <span key={i} className="text-xs text-muted-foreground">
                            {DAY_LABEL[s.day]} {formatTime(s.startTime)}–{formatTime(s.endTime)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 w-28 space-y-1 text-right">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: subPct + '%' }} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {subject.completedLessons} / {subject.totalLessons} lessons
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Teachers */}
      {hasTeachers && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Teachers</h2>
          <div className="space-y-1 text-sm">
            {course.subjects
              .filter(s => s.teachers.length > 0)
              .map(s => (
                <p key={s.id}>
                  <span className="font-medium">{s.title}:</span>{' '}
                  <span className="text-muted-foreground">
                    {s.teachers.map(t => t.firstName + ' ' + t.lastName).join(', ')}
                  </span>
                </p>
              ))}
          </div>
        </section>
      )}
    </div>
  )
}
