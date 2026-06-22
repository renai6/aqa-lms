import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getEnrollmentPaymentByRequest } from '@/lib/enrollments/queries'
import { UpdatePaymentStatusForm } from './update-payment-status-form'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
})

type Props = { requestId: string; userId: string; courseId: string }

export async function PaymentSection({ requestId, userId, courseId }: Props) {
  const payment = await getEnrollmentPaymentByRequest(userId, courseId)
  if (!payment) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge
            className={
              payment.paymentStatus === 'FULLY_PAID'
                ? 'bg-green-100 text-green-800 border-green-200'
                : 'bg-yellow-100 text-yellow-800 border-yellow-200'
            }
          >
            {payment.paymentStatus === 'FULLY_PAID' ? 'Fully Paid' : 'Partially Paid'}
          </Badge>
          <span className="text-sm">
            <strong>₱{payment.totalPaid.toLocaleString('en-PH')}</strong>
            {payment.course.tuitionFee !== null && (
              <span className="text-muted-foreground">
                {' '}/ ₱{payment.course.tuitionFee.toLocaleString('en-PH')}
              </span>
            )}
          </span>
        </div>

        {payment.paymentProofs.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Payment History</p>
            <div className="divide-y border rounded-md">
              {payment.paymentProofs.map(proof => (
                <div key={proof.id} className="px-3 py-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">₱{proof.amount.toLocaleString('en-PH')}</span>
                    <span className="text-muted-foreground text-xs">
                      {dateFormatter.format(proof.submittedAt)}
                    </span>
                  </div>
                  {proof.note && (
                    <p className="text-muted-foreground text-xs mt-0.5">{proof.note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <UpdatePaymentStatusForm requestId={requestId} currentStatus={payment.paymentStatus} />
      </CardContent>
    </Card>
  )
}
