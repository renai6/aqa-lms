'use client'
import { useActionState } from 'react'
import { deleteLessonAction } from '../../actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

type Props = { lessonId: string; subjectId: string; courseId: string; lessonTitle: string }

export function DeleteLessonPageButton({ lessonId, subjectId, courseId, lessonTitle }: Props) {
  const [state, formAction, isPending] = useActionState(deleteLessonAction, { error: null })
  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive text-sm">Danger Zone</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={isPending}>
              {isPending ? 'Deleting...' : 'Delete Lesson'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete &quot;{lessonTitle}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                This lesson will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <form action={formAction}>
                <input type="hidden" name="id" value={lessonId} />
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
      </CardContent>
    </Card>
  )
}
