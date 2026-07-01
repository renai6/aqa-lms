import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getCourseById } from '@/lib/courses/queries'
import { getCourseBatches } from '@/lib/batches/queries'
import { getSession } from '@/lib/auth/session'
import { PageHeader } from '@/components/admin/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const course = await getCourseById(id)
  return { title: course ? 'Batches - ' + course.title + ' — AQA Admin' : 'Batches — AQA Admin' }
}

export default async function BatchesPage({ params }: Props) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const [course, batches] = await Promise.all([getCourseById(id), getCourseBatches(id)])
  if (!course) notFound()

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Courses', href: '/admin/courses' },
          { label: course.title, href: '/admin/courses/' + id },
          { label: 'Batches' },
        ]}
        title="Batches"
      />

      {batches.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
          No batches yet. Start one from the course page.
        </p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Batch</th>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Students</th>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th scope="col" aria-label="Actions" className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {batches.map((batch) => (
                <tr key={batch.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 font-medium">Batch {batch.number}</td>
                  <td className="px-4 py-3">{batch._count.enrollments}</td>
                  <td className="px-4 py-3">
                    {batch.isActive
                      ? <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>
                      : <Badge variant="outline">Inactive</Badge>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={'/admin/courses/' + id + '/batches/' + batch.id}>
                        Manage <ChevronRight className="w-3 h-3 ml-1" aria-hidden="true" />
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
