'use client'

import { useActionState, useEffect, useId } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { KidActionState } from '@/lib/students/dependents'

type Props = {
  action: (prev: KidActionState, formData: FormData) => Promise<KidActionState>
  submitLabel: string
  hidden?: Record<string, string>
  defaults?: { firstName: string; lastName: string; gender: 'MALE' | 'FEMALE' | null }
  onSuccess?: () => void
}

// Shared by the parent's kids page and the admin student page.
export function KidForm({ action, submitLabel, hidden, defaults, onSuccess }: Props) {
  const [state, formAction, isPending] = useActionState(action, { error: null })
  // Unique per instance: a page renders one form per kid being edited plus the add form.
  const uid = useId()

  useEffect(() => {
    if (state.success) onSuccess?.()
  }, [state, onSuccess])

  return (
    <form action={formAction} className="space-y-3">
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-firstName`}>First name</Label>
          <Input id={`${uid}-firstName`} name="firstName" required defaultValue={defaults?.firstName} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-lastName`}>Last name</Label>
          <Input id={`${uid}-lastName`} name="lastName" required defaultValue={defaults?.lastName} />
        </div>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Gender</legend>
        <div className="flex gap-4 text-sm">
          {(['MALE', 'FEMALE'] as const).map((g) => (
            <label key={g} className="flex items-center gap-2">
              <input type="radio" name="gender" value={g} required defaultChecked={defaults?.gender === g} />
              {g === 'MALE' ? 'Male' : 'Female'}
            </label>
          ))}
        </div>
      </fieldset>
      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? 'Saving...' : submitLabel}
      </Button>
    </form>
  )
}
