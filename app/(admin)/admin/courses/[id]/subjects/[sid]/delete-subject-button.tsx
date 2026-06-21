'use client'

import { useActionState } from 'react'
import { deleteSubjectAction } from '../../actions'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Props = { subjectId: string; courseId: string; subjectTitle: string }

export function DeleteSubjectButton({ subjectId, courseId, subjectTitle }: Props) {
  const [state, formAction, isPending] = useActionState(deleteSubjectAction, { error: null })
  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive text-sm">Danger Zone</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full" disabled={isPending}>
              {isPending ? 'Deleting...' : 'Delete Subject'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete &quot;{subjectTitle}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the subject and all its lessons. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <form action={formAction}>
                <input type="hidden" name="id" value={subjectId} />
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
      </CardContent>
    </Card>
  )
}
