'use client'

import { useActionState } from 'react'
import { startNewBatchAction } from '@/lib/batches/actions'
import { Button } from '@/components/ui/button'

type Props = { courseId: string }

export function StartBatchButton({ courseId }: Props) {
  const [state, action, isPending] = useActionState(startNewBatchAction, { error: null })

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      'Start a new batch? New enrollments will be assigned to it. Existing students stay in their current batch.'
    )
    if (!confirmed) e.preventDefault()
  }

  return (
    <form action={action} onSubmit={handleSubmit}>
      <input type="hidden" name="courseId" value={courseId} />
      {state.error && <p className="text-xs text-destructive mb-1">{state.error}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? 'Starting…' : 'Start New Batch'}
      </Button>
    </form>
  )
}
