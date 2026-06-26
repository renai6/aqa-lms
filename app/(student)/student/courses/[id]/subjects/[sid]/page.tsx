import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { getStudentSubject } from '@/lib/student/queries'
import { LessonPlayer } from './lesson-player'

type Props = {
  params: Promise<{ id: string; sid: string }>
}

export async function generateMetadata({ params }: Props) {
  await params
  return { title: 'Subject — AQA Student' }
}

export default async function StudentSubjectPage({ params }: Props) {
  const { id, sid } = await params

  const session = await getSession()
  if (!session) redirect('/login')

  const subject = await getStudentSubject(session.userId, sid)
  if (!subject || subject.courseId !== id) notFound()

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* ── Header bar ── */}
      <header className="shrink-0 flex items-center gap-3 px-4 h-14 border-b border-border bg-background">
        <Link
          href={'/student/courses/' + id}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          {subject.course.title}
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-sm font-semibold truncate">{subject.title}</h1>
      </header>

      {/* ── Two-panel layout ── */}
      <LessonPlayer
        lessons={subject.lessons}
        subjectId={sid}
        courseId={id}
      />
    </div>
  )
}
