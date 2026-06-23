import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getLessonById } from '@/lib/courses/queries'
import { getSession } from '@/lib/auth/session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EditLessonForm } from './edit-lesson-form'
import { DeleteLessonPageButton } from './delete-lesson-button'

type Props = { params: Promise<{ id: string; sid: string; lid: string }> }

export async function generateMetadata({ params }: Props) {
  const { lid } = await params
  const lesson = await getLessonById(lid)
  return { title: lesson ? 'Edit: ' + lesson.title + ' — AQA Admin' : 'Lesson — AQA Admin' }
}

export default async function LessonEditPage({ params }: Props) {
  const { id, sid, lid } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const lesson = await getLessonById(lid)
  if (!lesson) notFound()
  if (lesson.subjectId !== sid) notFound()
  if (lesson.subject.courseId !== id) notFound()

  return (
    <div className="p-6 space-y-6">
      <Link
        href={'/admin/courses/' + id + '/subjects/' + sid}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to {lesson.subject.title}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Edit Lesson</h1>
        <p className="text-muted-foreground mt-1">{lesson.subject.course.title} › {lesson.subject.title}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EditLessonForm lesson={lesson} courseId={id} />
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Course</p>
                <p className="font-medium mt-0.5">{lesson.subject.course.title}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Subject</p>
                <p className="font-medium mt-0.5">{lesson.subject.title}</p>
              </div>
            </CardContent>
          </Card>
          <DeleteLessonPageButton
            lessonId={lid}
            subjectId={sid}
            courseId={id}
            lessonTitle={lesson.title}
          />
        </div>
      </div>
    </div>
  )
}
