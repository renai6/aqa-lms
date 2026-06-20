'use client'

import { useActionState } from 'react'
import { approveEnrollmentAction } from './actions'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

type ApproveButtonProps = { requestId: string }

export function ApproveButton({ requestId }: ApproveButtonProps) {
  const [state, formAction, isPending] = useActionState(approveEnrollmentAction, { error: null })

  return (
    <div className="space-y-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button className="w-full" disabled={isPending}>
            {isPending ? 'Processing...' : 'Approve Enrollment'}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this enrollment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a student account and send login credentials to the applicant. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <form action={formAction}>
              <input type="hidden" name="id" value={requestId} />
              <AlertDialogAction type="submit">Approve</AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      {state.success && !state.error && (
        <p className="text-sm text-green-600">Enrollment approved successfully.</p>
      )}
    </div>
  )
}
