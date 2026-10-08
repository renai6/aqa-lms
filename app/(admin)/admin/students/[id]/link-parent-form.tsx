'use client'

import { useActionState, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { linkToParentAdminAction } from '../actions'

export function LinkParentForm({ kidId }: { kidId: string }) {
  const uid = useId()
  // Controlled, so a failed attempt keeps what the admin typed.
  const [email, setEmail] = useState('')
  const [state, formAction, isPending] = useActionState(linkToParentAdminAction, { error: null })

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="kidId" value={kidId} />
      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-parentEmail`}>Parent&apos;s email</Label>
        <Input
          id={`${uid}-parentEmail`}
          name="parentEmail"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? 'Linking...' : 'Link to parent'}
      </Button>
    </form>
  )
}
