import Link from 'next/link'
import { Clock, GraduationCap, BookOpen, Users, ChevronRight } from 'lucide-react'
import { db } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/admin/page-header'

export const metadata = { title: 'Dashboard — AQA Admin' }

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export default async function AdminDashboardPage() {
  const [pendingCount, studentCount, publishedCourseCount, approvedCount, recentPending] =
    await Promise.all([
      db.enrollmentRequest.count({ where: { status: 'PENDING' } }),
      db.user.count({ where: { role: 'STUDENT', isActive: true } }),
      db.course.count({ where: { isPublished: true } }),
      db.enrollmentRequest.count({ where: { status: 'APPROVED' } }),
      db.enrollmentRequest.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { course: { select: { title: true } } },
      }),
    ])

  const stats = [
    {
      label: 'Pending Reviews',
      value: pendingCount,
      icon: Clock,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      href: '/admin/enrollments?tab=pending',
    },
    {
      label: 'Active Students',
      value: studentCount,
      icon: GraduationCap,
      iconBg: 'bg-muted',
      iconColor: 'text-muted-foreground',
      href: null,
    },
    {
      label: 'Published Courses',
      value: publishedCourseCount,
      icon: BookOpen,
      iconBg: 'bg-muted',
      iconColor: 'text-muted-foreground',
      href: '/admin/courses',
    },
    {
      label: 'Total Enrollments',
      value: approvedCount,
      icon: Users,
      iconBg: 'bg-muted',
      iconColor: 'text-muted-foreground',
      href: null,
    },
  ]

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <PageHeader title="Dashboard" />

      <p className="text-sm text-muted-foreground -mt-4">
        {pendingCount} pending · {studentCount} students · {publishedCourseCount} courses
      </p>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          const card = (
            <div className="p-4 border rounded-lg bg-card space-y-3">
              <div className={`w-8 h-8 rounded-md flex items-center justify-center ${stat.iconBg}`}>
                <Icon className={`w-4 h-4 ${stat.iconColor}`} aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            </div>
          )
          return stat.href ? (
            <Link key={stat.label} href={stat.href} className="hover:opacity-80 transition-opacity">
              {card}
            </Link>
          ) : (
            <div key={stat.label}>{card}</div>
          )
        })}
      </div>

      {/* Recent pending requests */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Recent Pending Reviews</h2>
          <Link
            href="/admin/enrollments?tab=pending"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all →
          </Link>
        </div>

        {recentPending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending reviews. You&apos;re all caught up.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Name</th>
                  <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Course</th>
                  <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Submitted</th>
                  <th scope="col" aria-label="Actions" className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentPending.map((req) => (
                  <tr key={req.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-2 font-medium">{req.firstName} {req.lastName}</td>
                    <td className="px-4 py-2 text-muted-foreground">{req.course.title}</td>
                    <td className="px-4 py-2 text-muted-foreground">{dateFormatter.format(req.createdAt)}</td>
                    <td className="px-4 py-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={'/admin/enrollments/' + req.id}>
                          Review
                          <ChevronRight className="w-3 h-3 ml-1" aria-hidden="true" />
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
    </div>
  )
}
