import { type EnrollmentStatus } from '@prisma/client'
import { getEnrollmentRequestsByStatus } from '@/lib/enrollments/queries'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Props = {
  searchParams: Promise<{ tab?: string }>
}

export const metadata = { title: 'Enrollments — AQA Admin' }

export default async function EnrollmentsPage({ searchParams }: Props) {
  const { tab } = await searchParams // Next.js 16: searchParams is a Promise

  // Map tab param to EnrollmentStatus
  const STATUS_MAP: Record<string, EnrollmentStatus> = {
    pending: 'PENDING',
    approved: 'APPROVED',
    rejected: 'REJECTED',
  }
  const status: EnrollmentStatus = STATUS_MAP[tab ?? ''] ?? 'PENDING'

  const requests = await getEnrollmentRequestsByStatus(status)

  // Tab config
  const tabs = [
    { label: 'Pending', value: 'pending' as const },
    { label: 'Approved', value: 'approved' as const },
    { label: 'Rejected', value: 'rejected' as const },
  ]

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
  }

  const getStatusBadge = (status: EnrollmentStatus) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="outline">Pending</Badge>
      case 'APPROVED':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            Approved
          </Badge>
        )
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>
      default:
        return null
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold">Enrollment Requests</h1>
        <p className="text-muted-foreground mt-1">
          Review and manage student enrollment applications.
        </p>
      </div>

      {/* Tab bar — plain Links, not shadcn Tabs (keeps this a pure server component) */}
      <div className="flex gap-1 border-b">
        {tabs.map((t) => {
          const isActive = STATUS_MAP[t.value] === status
          return (
            <Link
              key={t.value}
              href={`?tab=${t.value}`}
              className={cn(
                'px-4 pb-3 text-sm transition-colors',
                isActive
                  ? 'border-b-2 border-primary text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
              {isActive && (
                <span className="ml-2 inline-block bg-muted text-muted-foreground px-2 py-0.5 rounded text-xs font-medium">
                  {requests.length}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* Table */}
      {requests.length === 0 ? (
        <p className="text-muted-foreground">
          No {status.toLowerCase()} requests.
        </p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Name
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Email
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Course
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Submitted
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {requests.map((request) => (
                <tr
                  key={request.id}
                  className="hover:bg-muted/50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium">
                    {request.firstName} {request.lastName}
                  </td>
                  <td className="px-4 py-3">{request.email}</td>
                  <td className="px-4 py-3">{request.course.title}</td>
                  <td className="px-4 py-3">{formatDate(request.createdAt)}</td>
                  <td className="px-4 py-3">{getStatusBadge(request.status)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={'/admin/enrollments/' + request.id}
                      className="text-primary hover:underline text-sm"
                    >
                      View →
                    </Link>
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
