'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { submitEnrollmentAction } from '@/lib/enrollments/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Banknote, CreditCard } from 'lucide-react'

type Props = { courseId: string; courseTitle: string; tuitionFee: number | null }

export function EnrollForm({ courseId, courseTitle, tuitionFee }: Props) {
  const [state, formAction, isPending] = useActionState(submitEnrollmentAction, { error: null })
  const [paymentType, setPaymentType] = useState<'FULL' | 'PARTIAL'>('FULL')

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="courseId" value={courseId} />

      {/* Course info strip */}
      <div className="rounded-xl border bg-card p-4">
        <p className="font-semibold text-foreground">{courseTitle}</p>
        {tuitionFee != null ? (
          <>
            <span className="text-lg font-bold text-foreground">
              ₱{tuitionFee.toLocaleString('en-PH')}
            </span>
            <p className="mt-0.5 text-xs text-muted-foreground">Flexible installments available</p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Contact us for pricing</p>
        )}
      </div>

      {/* First Name */}
      <div className="space-y-2">
        <Label htmlFor="firstName">First Name</Label>
        <Input id="firstName" name="firstName" required placeholder="Juan" />
      </div>

      {/* Last Name */}
      <div className="space-y-2">
        <Label htmlFor="lastName">Last Name</Label>
        <Input id="lastName" name="lastName" required placeholder="dela Cruz" />
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input id="email" name="email" type="email" required placeholder="juan@example.com" />
      </div>

      {/* Payment Type — styled toggle cards */}
      <div className="space-y-2">
        <Label>Payment Type</Label>
        <div className="flex gap-3">
          {/* Full Payment */}
          <label className="flex-1 cursor-pointer">
            <input
              type="radio"
              name="paymentType"
              value="FULL"
              checked={paymentType === 'FULL'}
              onChange={() => setPaymentType('FULL')}
              className="sr-only"
            />
            <div
              className={[
                'rounded-xl border-2 p-4 transition-colors',
                paymentType === 'FULL' ? 'border-primary bg-primary/5' : 'border-border bg-card',
              ].join(' ')}
            >
              <Banknote className="mb-2 w-5 h-5 text-primary" />
              <p className="text-sm font-semibold text-foreground">Full Payment</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Pay the full tuition upfront</p>
            </div>
          </label>

          {/* Partial Payment */}
          <label className="flex-1 cursor-pointer">
            <input
              type="radio"
              name="paymentType"
              value="PARTIAL"
              checked={paymentType === 'PARTIAL'}
              onChange={() => setPaymentType('PARTIAL')}
              className="sr-only"
            />
            <div
              className={[
                'rounded-xl border-2 p-4 transition-colors',
                paymentType === 'PARTIAL'
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card',
              ].join(' ')}
            >
              <CreditCard className="mb-2 w-5 h-5 text-primary" />
              <p className="text-sm font-semibold text-foreground">Partial Payment</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Pay a portion now, rest later</p>
            </div>
          </label>
        </div>
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="amountPaid">Amount Paying Now (₱)</Label>
        <Input
          id="amountPaid"
          name="amountPaid"
          type="number"
          min="1"
          step="0.01"
          required
          placeholder="e.g. 5000"
        />
      </div>

      {/* Error */}
      {state.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {state.error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? 'Submitting...' : 'Submit Application'}
      </button>
    </form>
  )
}
