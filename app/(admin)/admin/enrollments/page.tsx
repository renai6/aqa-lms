import { type EnrollmentStatus } from '@prisma/client'
import { db } from '@/lib/db'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Inbox, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/admin/page-header'

type Props = {
  searchParams: Promise<{ tab?: string }>
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export const metadata = { title: 'Enrollments — AQA Admin' }

export default async function EnrollmentsPage({ searchParams }: Props) {
  const { tab } = await searchParams

  const STATUS_MAP: Record<string, EnrollmentStatus> = {
    pending: 'PENDING',
    approved: 'APPROVED',
    rejected: 'REJECTED',
  }
  const status: EnrollmentStatus = STATUS_MAP[tab ?? ''] ?? 'PENDING'

  const [requests, statusCounts] = await Promise.all([
    db.enrollmentRequest.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      include: { course: { select: { title: true } } },
    }),
    db.enrollmentRequest.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
  ])

  const countMap = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count._all])
  ) as Record<string, number>

  const tabs = [
    { label: 'Pending', value: 'pending', enumStatus: 'PENDING' as EnrollmentStatus },
    { label: 'Approved', value: 'approved', enumStatus: 'APPROVED' as EnrollmentStatus },
    { label: 'Rejected', value: 'rejected', enumStatus: 'REJECTED' as EnrollmentStatus },
  ]

  const getStatusBadge = (s: EnrollmentStatus) => {
    if (s === 'APPROVED')
      return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>
    if (s === 'REJECTED')
      return <Badge variant="destructive">Rejected</Badge>
    return <Badge variant="outline">Pending</Badge>
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Enrollment Requests"
        breadcrumbs={[{ label: 'Enrollments' }]}
      />

      {/* Tab bar */}
      <div className="flex gap-1 border-b -mt-2">
        {tabs.map((t) => {
          const isActive = t.enumStatus === status
          const count = countMap[t.enumStatus] ?? 0
          return (
            <Link
              key={t.value}
              href={`?tab=${t.value}`}
              className={cn(
                'flex items-center gap-1.5 px-4 pb-3 text-sm transition-colors',
                isActive
                  ? 'border-b-2 border-primary text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
              <span className="inline-block bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-xs font-medium">
                {count}
              </span>
            </Link>
          )
        })}
      </div>

      {requests.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Inbox className="w-8 h-8" aria-hidden="true" />
          <p className="text-sm">No {status.toLowerCase()} requests.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Name</th>
                <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Email</th>
                <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Course</th>
                <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Submitted</th>
                <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th scope="col" aria-label="Actions" className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {requests.map((request) => (
                <tr key={request.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-2 font-medium">{request.firstName} {request.lastName}</td>
                  <td className="px-4 py-2 text-muted-foreground">{request.email}</td>
                  <td className="px-4 py-2">{request.course.title}</td>
                  <td className="px-4 py-2 text-muted-foreground">{dateFormatter.format(request.createdAt)}</td>
                  <td className="px-4 py-2">{getStatusBadge(request.status)}</td>
                  <td className="px-4 py-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={'/admin/enrollments/' + request.id}>
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
