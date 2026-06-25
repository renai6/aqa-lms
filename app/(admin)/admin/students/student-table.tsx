// app/(admin)/admin/students/student-table.tsx
import Link from 'next/link'
import { ChevronRight, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { StudentRow } from '@/lib/students/queries'

type Props = { students: StudentRow[] }

export function StudentTable({ students }: Props) {
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
                  ? s.enrollments.map((e) => e.courseTitle).join(', ')
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
                  s.isActive ? 'bg-green-100 text-green-800' : 'bg-zinc-100 text-zinc-600',
                )}>
                  {s.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-4 py-3">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/admin/students/${s.id}`}>
                    <ChevronRight className="w-3 h-3" aria-hidden="true" />
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
