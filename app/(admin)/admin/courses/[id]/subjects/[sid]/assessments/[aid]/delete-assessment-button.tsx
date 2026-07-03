'use client'

import { useActionState } from 'react'
import { deleteAssessmentAction } from '../actions'
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
  assessmentId: string
  subjectId: string
  courseId: string
  assessmentTitle: string
  attemptCount: number
}

export function DeleteAssessmentButton({ assessmentId, subjectId, courseId, assessmentTitle, attemptCount }: Props) {
  const [state, formAction, isPending] = useActionState(deleteAssessmentAction, { error: null })

  if (attemptCount > 0) {
    return (
      <div className="space-y-2">
        <Button variant="outline" size="sm" disabled className="w-full text-muted-foreground">
          Delete Assessment
        </Button>
        <p className="text-xs text-muted-foreground">
          Cannot delete - {attemptCount} student {attemptCount === 1 ? 'attempt' : 'attempts'} exist. Unpublish instead.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            className="w-full text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
          >
            Delete Assessment
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{assessmentTitle}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This assessment and all its questions will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <form action={formAction}>
              <input type="hidden" name="id" value={assessmentId} />
              <input type="hidden" name="subjectId" value={subjectId} />
              <input type="hidden" name="courseId" value={courseId} />
              <AlertDialogAction
                type="submit"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </div>
  )
}
