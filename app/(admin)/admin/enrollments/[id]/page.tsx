import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { getEnrollmentRequestById } from '@/lib/enrollments/queries'
import { ProofOfPaymentViewer } from './proof-viewer'
import { ApproveForm } from './approve-form'
import { RejectForm } from './reject-form'
import { PaymentSection } from './payment-section'

type Props = { params: Promise<{ id: string }> }

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

type EnrollmentRequest = Awaited<ReturnType<typeof getEnrollmentRequestById>>

function StatusBadge({ status }: { status: NonNullable<EnrollmentRequest>['status'] }) {
  if (status === 'APPROVED') {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>
    )
  }
  if (status === 'REJECTED') {
    return <Badge variant="destructive">Rejected</Badge>
  }
  return <Badge variant="outline">Pending</Badge>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const request = await getEnrollmentRequestById(id)
  return {
    title: request
      ? `${request.firstName} ${request.lastName} — Enrollment — AQA Admin`
      : 'Enrollment — AQA Admin',
  }
}

export default async function EnrollmentDetailPage({ params }: Props) {
  const { id } = await params
  const request = await getEnrollmentRequestById(id)
  if (!request) notFound()

  const isPending = request.status === 'PENDING'

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <Link
        href="/admin/enrollments"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to Enrollments
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">
          {request.firstName} {request.lastName}
        </h1>
        <StatusBadge status={request.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Applicant info — 2/3 width */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Applicant Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="text-sm text-muted-foreground w-32 shrink-0">Email</span>
                <span className="text-sm">{request.email}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="text-sm text-muted-foreground w-32 shrink-0">Course</span>
                <span className="text-sm">{request.course.title}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="text-sm text-muted-foreground w-32 shrink-0">Submitted</span>
                <span className="text-sm">{dateFormatter.format(request.createdAt)}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="text-sm text-muted-foreground w-32 shrink-0">Payment Type</span>
                <span className="text-sm">
                  {request.paymentType === 'FULL' ? 'Full Payment' : 'Partial Payment'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="text-sm text-muted-foreground w-32 shrink-0">Amount Declared</span>
                <span className="text-sm">₱{request.amountPaid.toLocaleString('en-PH')}</span>
              </div>
              {request.adminRemarks && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                  <span className="text-sm text-muted-foreground w-32 shrink-0">Admin Remarks</span>
                  <span className="text-sm">{request.adminRemarks}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions — 1/3 width */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProofOfPaymentViewer requestId={id} hasProof={!!request.paymentProofUrl} />
              {isPending && (
                <>
                  <Separator />
                  <ApproveForm
                    requestId={id}
                    defaultPaymentStatus={
                      request.paymentType === 'FULL' ? 'FULLY_PAID' : 'PARTIALLY_PAID'
                    }
                  />
                  <Separator />
                  <RejectForm requestId={id} />
                </>
              )}
              {!isPending && (
                <p className="text-sm text-muted-foreground">
                  This request has been {request.status.toLowerCase()}.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {request.status === 'APPROVED' && request.userId && (
        <PaymentSection
          requestId={id}
          userId={request.userId}
          courseId={request.courseId}
        />
      )}
    </div>
  )
}
