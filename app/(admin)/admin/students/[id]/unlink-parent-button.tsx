'use client'

import { useActionState } from 'react'
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
import { unlinkFromParentAdminAction } from '../actions'

// Undoes a mistaken link for a student with their own login.
export function UnlinkParentButton({ kidId, parentName }: { kidId: string; parentName: string }) {
  const [state, formAction, isPending] = useActionState(unlinkFromParentAdminAction, { error: null })
  const formId = `unlink-parent-${kidId}`

  return (
    <>
      {/* AlertDialogContent renders into document.body, outside this form, so the
          confirm button cannot be a descendant of it - the form={formId} attribute
          on that button is what associates them, and must not be removed. */}
      <form action={formAction} id={formId}>
        <input type="hidden" name="kidId" value={kidId} />
      </form>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={isPending} className="text-destructive hover:text-destructive">
            {isPending ? 'Unlinking...' : 'Unlink from parent'}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{`Unlink from ${parentName}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              The parent will no longer be able to switch to this student. The student keeps their own login and all their records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" form={formId}>
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
    </>
  )
}
