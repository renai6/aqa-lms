import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSubjectById } from '@/lib/courses/queries'
import { getSubjectAssessments } from '@/lib/assessments/queries'
import { getSession } from '@/lib/auth/session'
import { PageHeader } from '@/components/admin/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, ClipboardList } from 'lucide-react'

type Props = { params: Promise<{ id: string; sid: string }> }

export async function generateMetadata({ params }: Props) {
  const { sid } = await params
  const subject = await getSubjectById(sid)
  return { title: subject ? 'Assessments: ' + subject.title + ' — AQA Admin' : 'Assessments — AQA Admin' }
}

export default async function AssessmentsPage({ params }: Props) {
  const { id, sid } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const [subject, assessments] = await Promise.all([
    getSubjectById(sid),
    getSubjectAssessments(sid),
  ])
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
          { label: 'Assessments' },
        ]}
        title="Assessments"
        action={
          <Button asChild>
            <Link href={'/admin/courses/' + id + '/subjects/' + sid + '/assessments/new'}>
              New Assessment
            </Link>
          </Button>
        }
      />

      {assessments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <ClipboardList className="w-8 h-8" aria-hidden="true" />
          <p className="text-sm">No assessments yet.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Title</th>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Type</th>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Questions</th>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Total Pts</th>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Attempts</th>
                <th scope="col" aria-label="Actions" className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {assessments.map(a => (
                <tr key={a.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{a.title}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{a.type}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {a.isPublished
                      ? <Badge variant="default">Published</Badge>
                      : <Badge variant="secondary">Draft</Badge>}
                  </td>
                  <td className="px-4 py-3">{a.questionCount}</td>
                  <td className="px-4 py-3">{a.totalPoints}</td>
                  <td className="px-4 py-3">{a.attemptCount}</td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={'/admin/courses/' + id + '/subjects/' + sid + '/assessments/' + a.id}>
                        Edit <ChevronRight className="w-3 h-3 ml-1" aria-hidden="true" />
                      </Link>
                    </Button>
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
