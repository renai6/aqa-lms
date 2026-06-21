'use client'

import { useActionState } from 'react'
import { toggleUserActiveAction } from './actions'
import { Button } from '@/components/ui/button'

type Props = {
  userId: string
  isActive: boolean
  userName: string
}

export function ToggleActiveButton({ userId, isActive, userName }: Props) {
  const [state, formAction, isPending] = useActionState(toggleUserActiveAction, { error: null })

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={userId} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={isPending}
        aria-label={isActive ? `Deactivate ${userName}` : `Reactivate ${userName}`}
        className={
          isActive
            ? 'text-destructive hover:text-destructive h-7 px-2'
            : 'text-muted-foreground hover:text-foreground h-7 px-2'
        }
      >
        {isPending ? '...' : isActive ? 'Deactivate' : 'Reactivate'}
      </Button>
      {state.error && <p className="text-xs text-destructive mt-1">{state.error}</p>}
    </form>
  )
}
