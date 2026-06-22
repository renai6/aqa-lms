import { notFound } from 'next/navigation'
import { getEnrollmentRequestById } from '@/lib/enrollments/queries'
import { UploadProofForm } from './upload-proof-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Smartphone, Building2 } from 'lucide-react'

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

export async function generateMetadata({ params }: Props) {
  const { requestId } = await params
  const request = await getEnrollmentRequestById(requestId)
  return {
    title: request
      ? `Enrollment — ${request.firstName} ${request.lastName} — Al-Qur'an Academy`
      : "Enrollment Confirmation — Al-Qur'an Academy",
  }
}

export default async function EnrollmentConfirmationPage({ params }: Props) {
  const { requestId } = await params
  const request = await getEnrollmentRequestById(requestId)
  if (!request) notFound()

  return (
    <>
      {/* ── Hero Banner ── */}
      <section
        className="relative bg-zinc-900 min-h-[max(40vh,320px)] flex items-center pt-20 pb-24"
        style={{ clipPath: 'polygon(0 0, 100% 0, 100% 88%, 0 100%)' }}
      >
        {/* Grain texture */}
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full opacity-[0.04] pointer-events-none mix-blend-overlay"
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="grain-confirm-hero">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-confirm-hero)" />
        </svg>

        {/* Emerald radial glow */}
        <div
          className="absolute top-0 left-0 w-96 h-96 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, oklch(0.7 0.2 160 / 0.25) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 max-w-2xl mx-auto w-full px-4 sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Application Received
          </span>
          <h1 className="mt-4 text-4xl sm:text-5xl font-bold text-white tracking-tight">
            You&apos;re all set, {request.firstName}!
          </h1>
          <p className="mt-3 text-base text-white/70 max-w-xl">
            Complete your payment and upload proof below. We&apos;ll notify you by email once
            verified.
          </p>
        </div>
      </section>

      {/* ── Cards Section ── */}
      <section className="-mt-px bg-background">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-6">

          {/* Application Summary */}
          <Card className="border-l-4 border-primary">
            <CardHeader>
              <CardTitle>Your Application</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex gap-4">
                <span className="w-28 shrink-0 text-muted-foreground">Name</span>
                <span className="font-medium">{request.firstName} {request.lastName}</span>
              </div>
              <div className="flex gap-4">
                <span className="w-28 shrink-0 text-muted-foreground">Email</span>
                <span className="font-medium">{request.email}</span>
              </div>
              <div className="flex gap-4">
                <span className="w-28 shrink-0 text-muted-foreground">Course</span>
                <span className="font-medium">{request.course.title}</span>
              </div>
              <div className="flex gap-4">
                <span className="w-28 shrink-0 text-muted-foreground">Submitted</span>
                <span className="font-medium">{dateFormatter.format(request.createdAt)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-lg bg-muted p-3 space-y-0.5">
                <div className="flex items-center gap-2 font-medium">
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                  GCash
                </div>
                <p className="pl-6 text-muted-foreground">{GCASH_NUMBER} — {GCASH_NAME}</p>
              </div>
              <div className="rounded-lg bg-muted p-3 space-y-0.5">
                <div className="flex items-center gap-2 font-medium">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  {BANK_NAME} Bank Transfer
                </div>
                <p className="pl-6 text-muted-foreground">Account No: {BANK_ACCOUNT_NO}</p>
                <p className="pl-6 text-muted-foreground">Account Name: {BANK_ACCOUNT_NAME}</p>
              </div>
              <p className="pt-1 text-xs text-muted-foreground">
                After payment, upload your screenshot or receipt below. You will be notified by
                email once your payment is verified.
              </p>
            </CardContent>
          </Card>

          {/* Upload Proof */}
          <Card>
            <CardHeader>
              <CardTitle>Upload Proof of Payment</CardTitle>
            </CardHeader>
            <CardContent>
              {request.paymentProofUrl ? (
                <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800/40 dark:bg-green-900/20 dark:text-green-300">
                  Proof of payment already received. We will notify you by email once reviewed.
                </p>
              ) : (
                <UploadProofForm requestId={requestId} />
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Footer Band ── */}
      <section className="bg-zinc-900 py-10 px-4">
        <p className="mx-auto max-w-xl text-center text-sm text-white/70">
          Questions about your application? Reach out to us and we&apos;ll be happy to help.
        </p>
      </section>
    </>
  )
}
