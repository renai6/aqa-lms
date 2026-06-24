// app/(student)/student/dashboard/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getSession } from '@/lib/auth/session'
import { getStudentDashboard } from '@/lib/student/queries'
import { AdditionalPaymentForm } from './additional-payment-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${mStr} ${period}`
}

const DAY_LABEL: Record<string, string> = {
  MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed',
  THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun',
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export const metadata = { title: 'Dashboard — AQA Student' }

export default async function StudentDashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const { enrollments, schedules, announcements } = await getStudentDashboard(session.userId)

  const partialEnrollments = enrollments.filter(e => e.paymentStatus === 'PARTIALLY_PAID')

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">

      {/* Welcome */}
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Schedules strip */}
      {schedules.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Upcoming Schedule</h2>
          <div className="flex flex-wrap gap-2">
            {schedules.map((s, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
              >
                <span className="font-semibold">{s.subjectTitle}</span>
                <span className="text-muted-foreground">·</span>
                <span>{DAY_LABEL[s.day]} {formatTime(s.startTime)}–{formatTime(s.endTime)}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Announcements</h2>
          <div className="space-y-3">
            {announcements.slice(0, 3).map(a => (
              <Card key={a.id}>
                <CardContent className="pt-4 pb-4">
                  <p className="font-medium text-sm">{a.title}</p>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{a.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* My Courses */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">My Courses</h2>
        {enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active enrollments.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {enrollments.map(e => {
              const pct = e.totalLessons > 0
                ? Math.round((e.completedLessons / e.totalLessons) * 100)
                : 0
              return (
                <Link key={e.id} href={'/student/courses/' + e.courseId} className="block group">
                  <Card className="h-full hover:border-primary transition-colors">
                    {e.course.imageUrl && (
                      <div className="relative h-32 w-full overflow-hidden rounded-t-lg">
                        <Image src={e.course.imageUrl} alt={e.course.title} fill className="object-cover" />
                      </div>
                    )}
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors">
                          {e.course.title}
                        </p>
                        <Badge
                          className={
                            e.paymentStatus === 'FULLY_PAID'
                              ? 'bg-green-100 text-green-800 border-green-200 shrink-0'
                              : 'bg-yellow-100 text-yellow-800 border-yellow-200 shrink-0'
                          }
                        >
                          {e.paymentStatus === 'FULLY_PAID' ? 'Fully Paid' : 'Partially Paid'}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: pct + '%' }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {e.completedLessons} of {e.totalLessons} lessons completed
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Payment summary */}
      {partialEnrollments.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Payment</h2>
          <div className="space-y-4">
            {partialEnrollments.map(e => (
              <Card key={e.id}>
                <CardHeader>
                  <CardTitle className="text-base">{e.course.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 text-sm">
                    <span>
                      <span className="text-muted-foreground">Paid: </span>
                      <strong>₱{e.totalPaid.toLocaleString('en-PH')}</strong>
                    </span>
                    {e.course.tuitionFee !== null && (
                      <span>
                        <span className="text-muted-foreground">Balance: </span>
                        <strong>₱{(e.course.tuitionFee - e.totalPaid).toLocaleString('en-PH')}</strong>
                      </span>
                    )}
                  </div>
                  {e.paymentProofs.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Payment history</p>
                      <div className="divide-y border rounded-md">
                        {e.paymentProofs.map(p => (
                          <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                            <div>
                              <span className="font-medium">₱{p.amount.toLocaleString('en-PH')}</span>
                              {p.note && <span className="text-muted-foreground ml-2">— {p.note}</span>}
                              <p className="text-xs text-muted-foreground">{dateFormatter.format(p.submittedAt)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-3">Submit Additional Payment</p>
                    <AdditionalPaymentForm enrollmentId={e.id} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
