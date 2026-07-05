import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getTeacherSubject, getSubjectStudents } from '@/lib/teacher/queries'
import { PageHeader } from '@/components/admin/page-header'
import { SubjectTabs } from '../subject-tabs'

type Props = { params: Promise<{ sid: string }> }

export const metadata = { title: 'Students — AQA Teacher' }

export default async function TeacherSubjectStudentsPage({ params }: Props) {
  const { sid } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const subject = await getTeacherSubject(session.userId, sid)
  if (!subject) notFound()

  const students = await getSubjectStudents(sid)

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        breadcrumbs={[
          { label: 'My Subjects', href: '/teacher/subjects' },
          { label: subject.courseTitle },
          { label: subject.title },
        ]}
        title={subject.title}
      />
      <SubjectTabs subjectId={sid} />

      {students.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border py-8 text-center text-sm">
          No students enrolled in this course yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th
                  scope="col"
                  className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Email
                </th>
                <th
                  scope="col"
                  className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Enrolled
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {s.lastName}, {s.firstName}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{s.email}</td>
                  <td className="text-muted-foreground px-4 py-3">
                    {s.enrolledAt.toLocaleDateString()}
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
