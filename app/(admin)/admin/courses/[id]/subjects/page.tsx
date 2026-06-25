import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getCourseById } from '@/lib/courses/queries'
import { PageHeader } from '@/components/admin/page-header'
import { getSession } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import { BookOpen, ChevronRight } from 'lucide-react'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const course = await getCourseById(id)
  return { title: course ? 'Subjects: ' + course.title + ' — AQA Admin' : 'Subjects — AQA Admin' }
}

export default async function SubjectsPage({ params }: Props) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const course = await getCourseById(id)
  if (!course) notFound()

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Courses', href: '/admin/courses' },
          { label: course.title, href: '/admin/courses/' + id },
          { label: 'Subjects' },
        ]}
        title="Subjects"
        action={
          <Button asChild>
            <Link href={'/admin/courses/' + id + '/subjects/new'}>New Subject</Link>
          </Button>
        }
      />

      {course.subjects.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <BookOpen className="w-8 h-8" aria-hidden="true" />
          <p className="text-sm">No subjects yet.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Order</th>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Title</th>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Units</th>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Lessons</th>
                <th scope="col" aria-label="Actions" className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {course.subjects.map((subject) => (
                <tr key={subject.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3">{subject.order}</td>
                  <td className="px-4 py-3 font-medium">{subject.title}</td>
                  <td className="px-4 py-3">{subject.units}</td>
                  <td className="px-4 py-3">{subject._count.lessons}</td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={'/admin/courses/' + id + '/subjects/' + subject.id}>
                        View <ChevronRight className="w-3 h-3 ml-1" aria-hidden="true" />
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
