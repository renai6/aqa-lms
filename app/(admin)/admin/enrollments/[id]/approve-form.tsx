'use client'

import { useActionState } from 'react'
import { approveEnrollmentAction } from './actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

type Props = {
  requestId: string
  defaultPaymentStatus: 'PARTIALLY_PAID' | 'FULLY_PAID'
}

export function ApproveForm({ requestId, defaultPaymentStatus }: Props) {
  const [state, formAction, isPending] = useActionState(approveEnrollmentAction, { error: null })

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={requestId} />
      <div className="space-y-2">
        <Label htmlFor="paymentStatus">Set Payment Status</Label>
        <select
          id="paymentStatus"
          name="paymentStatus"
          defaultValue={defaultPaymentStatus}
          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
        >
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="FULLY_PAID">Fully Paid</option>
        </select>
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Processing...' : 'Approve Enrollment'}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
