'use client'

import { useActionState } from 'react'
import { archiveCourseAction } from '../actions'
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

export function ArchiveCourseButton({ courseId, courseTitle }: Props) {
  const [state, formAction, isPending] = useActionState(archiveCourseAction, { error: null })
  return (
    <div className="space-y-1">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="w-full" disabled={isPending}>
            {isPending ? 'Archiving...' : 'Archive Course'}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive &quot;{courseTitle}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              The course will be hidden from students, the catalog, and this list. Nothing is
              deleted, and you can restore it from the Archived tab at any time.
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
                Archive
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </div>
  )
}
