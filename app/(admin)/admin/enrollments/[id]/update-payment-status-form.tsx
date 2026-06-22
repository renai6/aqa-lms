'use client'

import { useActionState } from 'react'
import { updatePaymentStatusAction } from './actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

type ActionState = { error: string | null; success?: boolean }

type Props = {
  requestId: string
  currentStatus: 'PARTIALLY_PAID' | 'FULLY_PAID'
}

export function UpdatePaymentStatusForm({ requestId, currentStatus }: Props) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    updatePaymentStatusAction,
    { error: null },
  )

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="requestId" value={requestId} />
      <div className="space-y-2">
        <Label htmlFor="paymentStatus">Payment Status</Label>
        <select
          id="paymentStatus"
          name="paymentStatus"
          defaultValue={currentStatus}
          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
        >
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="FULLY_PAID">Fully Paid</option>
        </select>
      </div>
      <Button type="submit" variant="outline" className="w-full" disabled={isPending}>
        {isPending ? 'Updating...' : 'Update Status'}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && !state.error && (
        <p className="text-sm text-green-600">Payment status updated.</p>
      )}
    </form>
  )
}
