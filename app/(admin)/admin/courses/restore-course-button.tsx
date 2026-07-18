'use client'

import { useActionState } from 'react'
import { restoreCourseAction } from './actions'
import { Button } from '@/components/ui/button'

export function RestoreCourseButton({ courseId }: { courseId: string }) {
  const [state, formAction, isPending] = useActionState(restoreCourseAction, { error: null })
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={courseId} />
      <Button type="submit" variant="outline" size="sm" disabled={isPending}>
        {isPending ? 'Restoring...' : 'Restore'}
      </Button>
      {state.error && <span className="ml-2 text-sm text-destructive">{state.error}</span>}
    </form>
  )
}
