'use client'

import { useActionState } from 'react'
import { togglePublishedAction } from '../actions'
import { Button } from '@/components/ui/button'

type Props = { courseId: string; isPublished: boolean }

export function TogglePublishedButton({ courseId, isPublished }: Props) {
  const [state, formAction, isPending] = useActionState(togglePublishedAction, { error: null })
  return (
    <div className="space-y-1">
      <form action={formAction}>
        <input type="hidden" name="id" value={courseId} />
        <input type="hidden" name="currentValue" value={String(isPublished)} />
        <Button type="submit" variant="outline" className="w-full" disabled={isPending}>
          {isPending ? 'Updating...' : isPublished ? 'Unpublish Course' : 'Publish Course'}
        </Button>
      </form>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </div>
  )
}
