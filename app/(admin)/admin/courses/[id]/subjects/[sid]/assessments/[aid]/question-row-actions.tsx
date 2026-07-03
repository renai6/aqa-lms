'use client'

import { useActionState } from 'react'
import { moveQuestionAction, deleteQuestionAction } from '../actions'
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
import { ChevronUp, ChevronDown } from 'lucide-react'

type Props = {
  questionId: string
  assessmentId: string
  subjectId: string
  courseId: string
  questionText: string
  isFirst: boolean
  isLast: boolean
  locked: boolean
}

export function QuestionRowActions({
  questionId,
  assessmentId,
  subjectId,
  courseId,
  questionText,
  isFirst,
  isLast,
  locked,
}: Props) {
  const [moveState, moveAction, movePending] = useActionState(moveQuestionAction, { error: null })
  const [deleteState, deleteAction, deletePending] = useActionState(deleteQuestionAction, { error: null })

  const hidden = (
    <>
      <input type="hidden" name="id" value={questionId} />
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <input type="hidden" name="courseId" value={courseId} />
    </>
  )

  return (
    <div className="flex items-center gap-1">
      <form action={moveAction}>
        {hidden}
        <input type="hidden" name="direction" value="up" />
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          disabled={isFirst || movePending}
          aria-label="Move up"
        >
          <ChevronUp className="w-4 h-4" />
        </Button>
      </form>
      <form action={moveAction}>
        {hidden}
        <input type="hidden" name="direction" value="down" />
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          disabled={isLast || movePending}
          aria-label="Move down"
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
      </form>
      {!locked && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={deletePending}
              className="text-destructive hover:text-destructive h-7 px-2"
            >
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this question?</AlertDialogTitle>
              <AlertDialogDescription>
                &quot;{questionText.length > 80 ? questionText.slice(0, 80) + '…' : questionText}&quot; will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <form action={deleteAction}>
                {hidden}
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
      )}
      {(moveState.error || deleteState.error) && (
        <p className="text-xs text-destructive">{moveState.error ?? deleteState.error}</p>
      )}
    </div>
  )
}
