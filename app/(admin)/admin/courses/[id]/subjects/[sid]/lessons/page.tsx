import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSubjectById } from '@/lib/courses/queries'
import { PageHeader } from '@/components/admin/page-header'
import { getSession } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import { BookOpen } from 'lucide-react'
import { DeleteLessonButton } from '../delete-lesson-button'

type Props = { params: Promise<{ id: string; sid: string }> }

export async function generateMetadata({ params }: Props) {
  const { sid } = await params
  const subject = await getSubjectById(sid)
  return { title: subject ? 'Lessons: ' + subject.title + ' — AQA Admin' : 'Lessons — AQA Admin' }
}

export default async function LessonsPage({ params }: Props) {
  const { id, sid } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const subject = await getSubjectById(sid)
  if (!subject) notFound()
  if (subject.courseId !== id) notFound()

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Courses', href: '/admin/courses' },
          { label: subject.course.title, href: '/admin/courses/' + id },
          { label: 'Subjects', href: '/admin/courses/' + id + '/subjects' },
          { label: subject.title, href: '/admin/courses/' + id + '/subjects/' + sid },
          { label: 'Lessons' },
        ]}
        title="Lessons"
        action={
          <Button asChild>
            <Link href={'/admin/courses/' + id + '/subjects/' + sid + '/lessons/new'}>New Lesson</Link>
          </Button>
        }
      />

      {subject.lessons.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <BookOpen className="w-8 h-8" aria-hidden="true" />
          <p className="text-sm">No lessons yet.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Order</th>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Title</th>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Material</th>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Recording</th>
                <th scope="col" aria-label="Actions" className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {subject.lessons.map((lesson) => (
                <tr key={lesson.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3">{lesson.order}</td>
                  <td className="px-4 py-3 font-medium">{lesson.title}</td>
                  <td className="px-4 py-3">
                    {lesson.materialUrl ? (
                      <a href={lesson.materialUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">Link</a>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {lesson.recordingUrl ? (
                      <a href={lesson.recordingUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">Link</a>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 flex items-center gap-2">
                    <Link
                      href={'/admin/courses/' + id + '/subjects/' + sid + '/lessons/' + lesson.id}
                      className="text-primary hover:underline text-sm"
                    >
                      Edit
                    </Link>
                    <DeleteLessonButton
                      lessonId={lesson.id}
                      subjectId={sid}
                      courseId={id}
                      lessonTitle={lesson.title}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
