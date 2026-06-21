import { notFound } from 'next/navigation'
import { getEnrollmentRequestById } from '@/lib/enrollments/queries'
import { UploadProofForm } from './upload-proof-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Props = { params: Promise<{ requestId: string }> }

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

// Update these with the academy's actual payment details before deploying
const GCASH_NUMBER = '09XX-XXX-XXXX'
const GCASH_NAME = 'Admin Name'
const BANK_NAME = 'BDO'
const BANK_ACCOUNT_NO = 'XXXX-XXXX-XXXX'
const BANK_ACCOUNT_NAME = 'Academy Name'

export const metadata = { title: "Enrollment Confirmation — Al-Qur'an Academy" }

export default async function EnrollmentConfirmationPage({ params }: Props) {
  const { requestId } = await params
  const request = await getEnrollmentRequestById(requestId)
  if (!request) notFound()

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Application Received</h1>
        <p className="text-muted-foreground mt-1">
          Please complete your payment and upload proof below.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Application</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex gap-4">
            <span className="text-muted-foreground w-28 shrink-0">Name</span>
            <span>{request.firstName} {request.lastName}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-muted-foreground w-28 shrink-0">Email</span>
            <span>{request.email}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-muted-foreground w-28 shrink-0">Course</span>
            <span>{request.course.title}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-muted-foreground w-28 shrink-0">Submitted</span>
            <span>{dateFormatter.format(request.createdAt)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-medium">GCash</p>
            <p className="text-muted-foreground">{GCASH_NUMBER} — {GCASH_NAME}</p>
          </div>
          <div>
            <p className="font-medium">{BANK_NAME} Bank Transfer</p>
            <p className="text-muted-foreground">Account No: {BANK_ACCOUNT_NO}</p>
            <p className="text-muted-foreground">Account Name: {BANK_ACCOUNT_NAME}</p>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            After payment, upload your screenshot or receipt below. You will be notified by email once your payment is verified.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload Proof of Payment</CardTitle>
        </CardHeader>
        <CardContent>
          {request.paymentProofUrl ? (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-3">
              Proof of payment already received. We will notify you by email once reviewed.
            </p>
          ) : (
            <UploadProofForm requestId={requestId} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
