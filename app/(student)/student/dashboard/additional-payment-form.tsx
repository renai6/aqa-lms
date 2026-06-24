// app/(student)/student/dashboard/additional-payment-form.tsx
'use client'

import { useActionState } from 'react'
import { submitAdditionalPaymentAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ActionState = { error: string | null; success?: boolean }
type Props = { enrollmentId: string }

export function AdditionalPaymentForm({ enrollmentId }: Props) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    submitAdditionalPaymentAction,
    { error: null },
  )

  if (state.success) {
    return (
      <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-3">
        Payment proof submitted. An admin will review it and update your payment status.
      </p>
    )
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <div className="space-y-2">
        <Label htmlFor={'amount-' + enrollmentId}>Amount Paid (₱)</Label>
        <Input id={'amount-' + enrollmentId} name="amount" type="number" min="1" step="0.01" required placeholder="e.g. 5000" />
      </div>
      <div className="space-y-2">
        <Label htmlFor={'note-' + enrollmentId}>Note (optional)</Label>
        <Input id={'note-' + enrollmentId} name="note" placeholder="e.g. 2nd installment via GCash" />
      </div>
      <div className="space-y-2">
        <Label htmlFor={'file-' + enrollmentId}>Proof of Payment</Label>
        <Input id={'file-' + enrollmentId} name="file" type="file" accept="image/jpeg,image/png,image/webp" required />
        <p className="text-xs text-muted-foreground">Accepted: JPG, PNG, WEBP. Max 5MB.</p>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Uploading...' : 'Submit Payment Proof'}
      </Button>
    </form>
  )
}
