import { getCourses } from '@/lib/courses/queries'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Courses — AQA Admin' }

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default async function CoursesPage() {
  const courses = await getCourses()
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Courses</h1>
          <p className="text-muted-foreground mt-1">Manage courses and their content.</p>
        </div>
        <Button asChild>
          <Link href="/admin/courses/new">New Course</Link>
        </Button>
      </div>

      {courses.length === 0 ? (
        <p className="text-muted-foreground">No courses yet. Create your first course.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Title</th>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Subjects</th>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Passing Grade</th>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Created</th>
                <th scope="col" aria-label="Actions" className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {courses.map(course => (
                <tr key={course.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{course.title}</td>
                  <td className="px-4 py-3">
                    {course.isPublished
                      ? <Badge className="bg-green-100 text-green-800 border-green-200">Published</Badge>
                      : <Badge variant="outline">Draft</Badge>}
                  </td>
                  <td className="px-4 py-3">{course._count.subjects}</td>
                  <td className="px-4 py-3">{course.passingGrade}%</td>
                  <td className="px-4 py-3">{dateFormatter.format(course.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Link href={'/admin/courses/' + course.id} className="text-primary hover:underline text-sm">View →</Link>
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
