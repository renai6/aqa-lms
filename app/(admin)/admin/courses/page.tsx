import { getCourses } from '@/lib/courses/queries'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BookOpen, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/admin/page-header'

export const metadata = { title: 'Courses — AQA Admin' }

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export default async function CoursesPage() {
  const courses = await getCourses()

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Courses"
        action={
          <Button asChild>
            <Link href="/admin/courses/new">New Course</Link>
          </Button>
        }
      />

      {courses.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <BookOpen className="w-8 h-8" aria-hidden="true" />
          <p className="text-sm">No courses yet. Create your first course.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Title</th>
                <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Type</th>
                <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Subjects</th>
                <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Passing Grade</th>
                <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Created</th>
                <th scope="col" aria-label="Actions" className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {courses.map((course) => (
                <tr key={course.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-2 font-medium">{course.title}</td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className={course.courseType === 'ONLINE' ? 'border-blue-300 text-blue-700' : 'border-amber-300 text-amber-700'}>
                      {course.courseType === 'ONLINE' ? 'Online' : 'On-Site'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    {course.isPublished
                      ? <Badge className="bg-green-100 text-green-800 border-green-200">Published</Badge>
                      : <Badge variant="outline">Draft</Badge>}
                  </td>
                  <td className="px-4 py-2">{course._count.subjects}</td>
                  <td className="px-4 py-2">{course.passingGrade}%</td>
                  <td className="px-4 py-2 text-muted-foreground">{dateFormatter.format(course.createdAt)}</td>
                  <td className="px-4 py-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={'/admin/courses/' + course.id}>
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
