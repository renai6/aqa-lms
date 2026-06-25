'use client'

import { useActionState } from 'react'
import { rejectPurchaseAction } from './actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export function RejectForm({ id }: { id: string }) {
  const [state, action, isPending] = useActionState(rejectPurchaseAction, { error: null })
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Label htmlFor="reason">Rejection reason</Label>
      <Textarea id="reason" name="reason" required rows={3} placeholder="Explain why this purchase is rejected" />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" variant="destructive" disabled={isPending}>
        {isPending ? 'Rejecting…' : 'Reject purchase'}
      </Button>
    </form>
  )
}
