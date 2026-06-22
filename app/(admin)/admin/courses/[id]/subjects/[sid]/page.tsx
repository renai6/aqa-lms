import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSubjectById, getTeachers } from '@/lib/courses/queries'
import { PageHeader } from '@/components/admin/page-header'
import { getSession } from '@/lib/auth/session'
import { EditSubjectForm } from './edit-subject-form'
import { DeleteSubjectButton } from './delete-subject-button'
import { TeacherAssignmentPanel } from './teacher-assignment-panel'
import { SchedulePanel } from './schedule-panel'
import { AddLessonForm } from './add-lesson-form'
import { DeleteLessonButton } from './delete-lesson-button'

type Props = { params: Promise<{ id: string; sid: string }> }

export async function generateMetadata({ params }: Props) {
  const { sid } = await params
  const subject = await getSubjectById(sid)
  return { title: subject ? subject.title + ' — AQA Admin' : 'Subject — AQA Admin' }
}

export default async function SubjectDetailPage({ params }: Props) {
  const { id, sid } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const [subject, allTeachers] = await Promise.all([getSubjectById(sid), getTeachers()])
  if (!subject) notFound()
  if (subject.courseId !== id) notFound()

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Courses', href: '/admin/courses' },
          { label: subject.course.title, href: '/admin/courses/' + id },
          { label: subject.title },
        ]}
        title={subject.title}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <EditSubjectForm subject={subject} />
        </div>
        <div className="space-y-4">
          <TeacherAssignmentPanel
            subjectId={sid}
            courseId={id}
            currentTeachers={subject.teachers}
            allTeachers={allTeachers}
          />
          <SchedulePanel
            subjectId={sid}
            courseId={id}
            schedules={subject.schedules}
          />
          <DeleteSubjectButton subjectId={sid} courseId={id} subjectTitle={subject.title} />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Lessons</h2>
        {subject.lessons.length === 0 ? (
          <p className="text-muted-foreground text-sm">No lessons yet.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th
                    scope="col"
                    className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                  >
                    Order
                  </th>
                  <th
                    scope="col"
                    className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                  >
                    Title
                  </th>
                  <th
                    scope="col"
                    className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                  >
                    Material
                  </th>
                  <th
                    scope="col"
                    className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                  >
                    Recording
                  </th>
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
                        <a
                          href={lesson.materialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-xs truncate max-w-32 block"
                        >
                          Link
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {lesson.recordingUrl ? (
                        <a
                          href={lesson.recordingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-xs"
                        >
                          Link
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 flex items-center gap-2">
                      <Link
                        href={
                          '/admin/courses/' + id + '/subjects/' + sid + '/lessons/' + lesson.id
                        }
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

        <AddLessonForm subjectId={sid} courseId={id} nextOrder={subject.lessons.length + 1} />
      </div>
    </div>
  )
}
