'use client'

import { useActionState } from 'react'
import { startAttemptAction } from '../../../actions'
import { Button } from '@/components/ui/button'

type Props = {
  assessmentId: string
  courseId: string
  subjectId: string
}

// startAttemptAction is a useActionState action, so it needs a client form -
// the same pattern as StartAttemptButton on the assessment launch page.
export function RetakeButton({ assessmentId, courseId, subjectId }: Props) {
  const [state, action, pending] = useActionState(startAttemptAction, { error: null })

  return (
    <form action={action} className="mt-2 space-y-2">
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? 'Loading…' : 'Try again'}
      </Button>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  )
}
