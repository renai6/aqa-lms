'use client'

import { useActionState } from 'react'
import { approvePurchaseAction } from './actions'
import { Button } from '@/components/ui/button'

export function ApproveForm({ id }: { id: string }) {
  const [state, action, isPending] = useActionState(approvePurchaseAction, { error: null })
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {state.error && <p className="mb-2 text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={isPending} className="bg-green-600 hover:bg-green-700">
        {isPending ? 'Approving…' : 'Approve purchase'}
      </Button>
    </form>
  )
}
