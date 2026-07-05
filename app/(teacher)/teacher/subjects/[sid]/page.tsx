import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getTeacherSubject } from '@/lib/teacher/queries'
import { PageHeader } from '@/components/admin/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SubjectTabs } from './subject-tabs'

type Props = { params: Promise<{ sid: string }> }

export async function generateMetadata({ params }: Props) {
  const { sid } = await params
  const session = await getSession()
  const subject = session ? await getTeacherSubject(session.userId, sid) : null
  return {
    title: subject ? subject.title + ' — AQA Teacher' : 'Subject — AQA Teacher',
  }
}

export default async function TeacherSubjectPage({ params }: Props) {
  const { sid } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const subject = await getTeacherSubject(session.userId, sid)
  if (!subject) notFound()

  const base = '/teacher/subjects/' + sid

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        breadcrumbs={[
          { label: 'My Subjects', href: '/teacher/subjects' },
          { label: subject.courseTitle },
          { label: subject.title },
        ]}
        title={subject.title}
        action={
          <Button asChild size="sm">
            <Link href={base + '/assessments/new'}>New Assessment</Link>
          </Button>
        }
      />
      <SubjectTabs subjectId={sid} />

      {subject.assessments.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border py-8 text-center text-sm">
          No assessments yet.
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
                  Assessment
                </th>
                <th
                  scope="col"
                  className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Type
                </th>
                <th
                  scope="col"
                  className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
                >
                  Questions
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
              {subject.assessments.map((a) => (
                <tr key={a.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={base + '/assessments/' + a.id}
                      className="text-primary font-medium hover:underline"
                    >
                      {a.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">
                      {a.type === 'QUIZ' ? 'Quiz' : 'Exam'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {a.isPublished ? (
                      <span className="text-green-600">Published</span>
                    ) : (
                      <span className="text-muted-foreground">Draft</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{a.questionCount}</td>
                  <td className="px-4 py-3">
                    {a.pendingGrading > 0 ? (
                      <Badge
                        variant="outline"
                        className="border-amber-300 bg-amber-50 text-amber-700"
                      >
                        {a.pendingGrading}
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
