// app/(student)/student/courses/[id]/subjects/[sid]/lesson-done-button.tsx
'use client'

import { useActionState } from 'react'
import { markLessonDoneAction, unmarkLessonDoneAction } from './actions'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'

type Props = {
  lessonId: string
  subjectId: string
  courseId: string
  isCompleted: boolean
}

export function LessonDoneButton({ lessonId, subjectId, courseId, isCompleted }: Props) {
  const [, markAction, markPending] = useActionState(markLessonDoneAction, { error: null })
  const [, unmarkAction, unmarkPending] = useActionState(unmarkLessonDoneAction, { error: null })

  const isPending = markPending || unmarkPending
  const formAction = isCompleted ? unmarkAction : markAction

  return (
    <form action={formAction}>
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <input type="hidden" name="courseId" value={courseId} />
      <Button
        type="submit"
        variant={isCompleted ? 'default' : 'outline'}
        size="sm"
        disabled={isPending}
        className={isCompleted ? 'bg-green-600 hover:bg-green-700' : ''}
      >
        {isCompleted ? (
          <><Check className="w-3 h-3 mr-1" aria-hidden="true" />Done</>
        ) : (
          'Mark as Done'
        )}
      </Button>
    </form>
  )
}
