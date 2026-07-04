'use client'

import { useActionState } from 'react'
import { startAttemptAction } from '../actions'
import { Button } from '@/components/ui/button'

type Props = {
  assessmentId: string
  courseId: string
  subjectId: string
  resume: boolean
}

export function StartAttemptButton({ assessmentId, courseId, subjectId, resume }: Props) {
  const [state, action, pending] = useActionState(startAttemptAction, { error: null })

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Loading…' : resume ? 'Resume attempt' : 'Start assessment'}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
