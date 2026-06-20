'use client'

import { useActionState } from 'react'
import { rejectEnrollmentAction } from './actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

type RejectFormProps = { requestId: string }

export function RejectForm({ requestId }: RejectFormProps) {
  const [state, formAction, isPending] = useActionState(rejectEnrollmentAction, { error: null })

  return (
    <div className="space-y-3">
      {state.success ? (
        <p className="text-sm text-green-600">Enrollment rejected. The applicant has been notified.</p>
      ) : (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="id" value={requestId} />
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason for rejection</Label>
            <Textarea
              id="reason"
              name="reason"
              placeholder="Explain why this application is being rejected..."
              rows={3}
              required
            />
          </div>
          <Button type="submit" variant="destructive" disabled={isPending} className="w-full">
            {isPending ? 'Rejecting...' : 'Reject Enrollment'}
          </Button>
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
        </form>
      )}
    </div>
  )
}
