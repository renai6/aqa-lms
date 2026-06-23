// app/(admin)/admin/students/[id]/page.tsx
import { notFound } from 'next/navigation'
import { getStudentById } from '@/lib/students/queries'
import { PageHeader } from '@/components/admin/page-header'
import { cn } from '@/lib/utils'

type Props = { params: Promise<{ id: string }> }

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export default async function StudentDetailPage({ params }: Props) {
  const { id } = await params
  const student = await getStudentById(id)
  if (!student) notFound()

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        breadcrumbs={[
          { label: 'Students', href: '/admin/students' },
          { label: `${student.firstName} ${student.lastName}` },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Enrollments — main area */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Enrollments
          </h2>
          {student.enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No enrollments.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Course</th>
                    <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Enrolled</th>
                    <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Progress</th>
                    <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {student.enrollments.map((e) => (
                    <tr key={e.courseId} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-medium">{e.courseTitle}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {dateFormatter.format(e.enrolledAt)}
                      </td>
                      <td className="px-4 py-3">{e.progress}%</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                          e.paymentStatus === 'FULLY_PAID'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800',
                        )}>
                          {e.paymentStatus === 'FULLY_PAID' ? 'Fully Paid' : 'Partially Paid'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Profile — sidebar */}
        <div className="border rounded-lg p-4 space-y-3 self-start">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Profile
          </h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Full name</dt>
              <dd className="font-medium mt-0.5">{student.firstName} {student.lastName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="mt-0.5">{student.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Gender</dt>
              <dd className="mt-0.5">
                {student.gender ? (student.gender === 'MALE' ? 'Male' : 'Female') : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="mt-0.5">
                <span className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                  student.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-zinc-100 text-zinc-600',
                )}>
                  {student.isActive ? 'Active' : 'Inactive'}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="mt-0.5">{dateFormatter.format(student.createdAt)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}
