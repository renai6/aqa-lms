import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getStudentEnrollment } from '@/lib/enrollments/queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AdditionalPaymentForm } from './additional-payment-form'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
})

export default async function StudentDashboardPage() {
  const session = await getSession()
  if (!session) notFound()

  const enrollment = await getStudentEnrollment(session.id)

  return (
    <main className="p-8 max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Student Dashboard</h1>

      {!enrollment && (
        <p className="text-muted-foreground">No active enrollment found.</p>
      )}

      {enrollment && (
        <Card>
          <CardHeader>
            <CardTitle>My Enrollment &amp; Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{enrollment.course.title}</p>
                <p className="text-sm text-muted-foreground">
                  Enrolled {dateFormatter.format(enrollment.enrolledAt)}
                </p>
              </div>
              <Badge
                className={
                  enrollment.paymentStatus === 'FULLY_PAID'
                    ? 'bg-green-100 text-green-800 border-green-200'
                    : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                }
              >
                {enrollment.paymentStatus === 'FULLY_PAID' ? 'Fully Paid' : 'Partially Paid'}
              </Badge>
            </div>

            <div className="text-sm">
              <span className="text-muted-foreground">Total Paid: </span>
              <strong>₱{enrollment.totalPaid.toLocaleString('en-PH')}</strong>
              {enrollment.course.tuitionFee !== null && (
                <span className="text-muted-foreground">
                  {' '}of ₱{enrollment.course.tuitionFee.toLocaleString('en-PH')}
                </span>
              )}
            </div>

            {enrollment.paymentProofs.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Payment History</p>
                <div className="divide-y border rounded-md">
                  {enrollment.paymentProofs.map(proof => (
                    <div key={proof.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">₱{proof.amount.toLocaleString('en-PH')}</span>
                        {proof.note && (
                          <span className="text-muted-foreground ml-2">— {proof.note}</span>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {dateFormatter.format(proof.submittedAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {enrollment.paymentStatus === 'PARTIALLY_PAID' && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">Submit Additional Payment</p>
                <AdditionalPaymentForm />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  )
}
