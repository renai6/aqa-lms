'use client'

import { useActionState } from 'react'
import { deleteCourseAction } from '../actions'
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

type Props = { courseId: string; courseTitle: string }

export function DeleteCourseButton({ courseId, courseTitle }: Props) {
  const [state, formAction, isPending] = useActionState(deleteCourseAction, { error: null })
  return (
    <div className="space-y-1">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="w-full" disabled={isPending}>
            {isPending ? 'Deleting...' : 'Delete Course'}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{courseTitle}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the course, all its subjects, and all lessons. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <form action={formAction}>
              <input type="hidden" name="id" value={courseId} />
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
