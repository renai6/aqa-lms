'use client'

import { useActionState } from 'react'
import { approveEnrollmentAction } from './actions'
import { Button } from '@/components/ui/button'

type ApproveButtonProps = { requestId: string }

export function ApproveButton({ requestId }: ApproveButtonProps) {
  const [state, formAction, isPending] = useActionState(approveEnrollmentAction, { error: null })

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={requestId} />
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Processing...' : 'Approve Enrollment'}
      </Button>
      {state.error && (
        <p className="text-sm text-destructive mt-2">{state.error}</p>
      )}
      {state.success && !state.error && (
        <p className="text-sm text-green-600 mt-2">Enrollment approved successfully.</p>
      )}
    </form>
  )
}
