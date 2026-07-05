import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getTeacherSubjects } from '@/lib/teacher/queries'
import { PageHeader } from '@/components/admin/page-header'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'My Subjects — AQA Teacher' }

export default async function TeacherSubjectsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const subjects = await getTeacherSubjects(session.userId)

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="My Subjects" />

      {subjects.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border py-8 text-center text-sm">
          You are not assigned to any subjects yet.
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
                  Subject
                </th>
                <th
                  scope="col"
                  className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Course
                </th>
                <th
                  scope="col"
                  className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Students
                </th>
                <th
                  scope="col"
                  className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Assessments
                </th>
                <th
                  scope="col"
                  className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                >
                  To grade
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {subjects.map((s) => (
                <tr key={s.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={'/teacher/subjects/' + s.id}
                      className="text-primary font-medium hover:underline"
                    >
                      {s.title}
                    </Link>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {s.courseTitle}
                  </td>
                  <td className="px-4 py-3">{s.studentCount}</td>
                  <td className="px-4 py-3">{s.assessmentCount}</td>
                  <td className="px-4 py-3">
                    {s.pendingGrading > 0 ? (
                      <Badge
                        variant="outline"
                        className="border-amber-300 bg-amber-50 text-amber-700"
                      >
                        {s.pendingGrading}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
