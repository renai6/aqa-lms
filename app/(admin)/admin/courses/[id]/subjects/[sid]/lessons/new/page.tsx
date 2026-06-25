import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getSubjectById } from '@/lib/courses/queries'
import { getSession } from '@/lib/auth/session'
import { CreateLessonForm } from './create-lesson-form'

type Props = { params: Promise<{ id: string; sid: string }> }

export async function generateMetadata({ params }: Props) {
  const { sid } = await params
  const subject = await getSubjectById(sid)
  return { title: subject ? 'New Lesson — ' + subject.title + ' — AQA Admin' : 'New Lesson — AQA Admin' }
}

export default async function NewLessonPage({ params }: Props) {
  const { id, sid } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const subject = await getSubjectById(sid)
  if (!subject) notFound()
  if (subject.courseId !== id) notFound()

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Link
        href={'/admin/courses/' + id + '/subjects/' + sid + '/lessons'}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to Lessons
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">New Lesson</h1>
        <p className="text-muted-foreground mt-1">{subject.course.title} › {subject.title}</p>
      </div>
      <CreateLessonForm subjectId={sid} courseId={id} nextOrder={subject.lessons.length + 1} />
    </div>
  )
}
