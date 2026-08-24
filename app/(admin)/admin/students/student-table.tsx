// app/(admin)/admin/students/student-table.tsx
import Link from 'next/link'
import { ChevronRight, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { StudentRow } from '@/lib/students/queries'
import { RemoveEnrollmentButton } from '@/components/admin/remove-enrollment-button'

// `courseId` is the course the list is currently filtered to. Remove/Restore is
// offered only then, because outside a course filter there is no single
// enrollment the action could unambiguously target.
type Props = { students: StudentRow[]; courseId?: string }

export function StudentTable({ students, courseId }: Props) {
  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <Inbox className="w-8 h-8" aria-hidden="true" />
        <p className="text-sm">No students found.</p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Name</th>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Email</th>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Gender</th>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Course(s)</th>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Enrolled</th>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
            <th scope="col" aria-label="Actions" className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {students.map((s) => (
            <tr key={s.id} className="hover:bg-muted/50 transition-colors">
              <td className="px-4 py-3 font-medium">{s.firstName} {s.lastName}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.email}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {s.gender ? (s.gender === 'MALE' ? 'Male' : 'Female') : '—'}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {s.enrollments.length > 0
                  ? s.enrollments.map((e, i) => (
                      <span key={e.id}>
                        {i > 0 && ', '}
                        <span className={cn(e.removedAt && 'line-through')}>
                          {e.courseTitle}
                        </span>
                      </span>
                    ))
                  : '—'}
              </td>
              <td className="px-4 py-3 text-muted-foreground text-xs">
                {s.enrollments[0]
                  ? s.enrollments[0].enrolledAt.toLocaleDateString()
                  : '—'}
              </td>
              <td className="px-4 py-3">
                <span className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                  s.isActive ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground',
                )}>
                  {s.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  {filtered(s, courseId)}
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/admin/students/${s.id}`}>
                      <ChevronRight className="w-3 h-3" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// The enrollment the current course filter points at, rendered as its
// remove/restore control. Nothing is rendered when no course is selected.
function filtered(student: StudentRow, courseId?: string) {
  if (!courseId) return null
  const enrollment = student.enrollments.find((e) => e.courseId === courseId)
  if (!enrollment) return null
  return (
    <RemoveEnrollmentButton
      enrollmentId={enrollment.id}
      studentName={`${student.firstName} ${student.lastName}`}
      courseTitle={enrollment.courseTitle}
      isRemoved={enrollment.removedAt !== null}
    />
  )
}
