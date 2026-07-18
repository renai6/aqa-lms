'use client'

import { useActionState } from 'react'
import { toggleStudentActiveAction } from './actions'
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

type Props = {
  studentId: string
  isActive: boolean
  studentName: string
}

export function DeactivateStudentButton({ studentId, isActive, studentName }: Props) {
  const [state, formAction, isPending] = useActionState(toggleStudentActiveAction, {
    error: null,
  })

  // Reactivation is harmless and skips the dialog. Deactivation cuts off access,
  // so it gets one deliberate confirmation step.
  if (!isActive) {
    return (
      <form action={formAction}>
        <input type="hidden" name="userId" value={studentId} />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={isPending}
          aria-label={`Reactivate ${studentName}`}
          className="w-full"
        >
          {isPending ? 'Reactivating...' : 'Reactivate'}
        </Button>
        {state.error && <p className="text-xs text-destructive mt-1">{state.error}</p>}
      </form>
    )
  }

  const formId = `deactivate-student-${studentId}`

  return (
    <>
      {/* AlertDialogContent wraps itself in AlertDialogPortal and renders into document.body,
          outside this form, so the confirm button below cannot be a descendant of it - the
          form={formId} attribute on that button is what associates them, and must not be removed. */}
      <form action={formAction} id={formId}>
        <input type="hidden" name="userId" value={studentId} />
      </form>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            aria-label={`Deactivate ${studentName}`}
            className="text-destructive hover:text-destructive w-full"
          >
            {isPending ? 'Deactivating...' : 'Deactivate'}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {studentName}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will be signed out and will not be able to log in, submit assessments, or
              make purchases. Their enrollments, grades, payments and certificates are kept,
              and you can reactivate them at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" form={formId}>
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {state.error && <p className="text-xs text-destructive mt-1">{state.error}</p>}
    </>
  )
}
