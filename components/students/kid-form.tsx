'use client'

import { useActionState, useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { KidActionState } from '@/lib/students/dependents'

type Props = {
  action: (prev: KidActionState, formData: FormData) => Promise<KidActionState>
  submitLabel: string
  hidden?: Record<string, string>
  defaults?: { firstName: string; lastName: string; gender: 'MALE' | 'FEMALE' | null }
  onSuccess?: () => void
  // One column, for narrow places like the admin student page's sidebar.
  stacked?: boolean
}

// Shared by the parent's kids page and the admin student page.
export function KidForm({ action, submitLabel, hidden, defaults, onSuccess, stacked }: Props) {
  // Unique per instance: a page renders one form per kid being edited plus the add form.
  const uid = useId()
  // React resets uncontrolled fields after every form action, even a failed one,
  // so the values are controlled to keep what the user typed when there is an error.
  const [firstName, setFirstName] = useState(defaults?.firstName ?? '')
  const [lastName, setLastName] = useState(defaults?.lastName ?? '')
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | null>(defaults?.gender ?? null)
  const onSuccessRef = useRef(onSuccess)
  useEffect(() => {
    onSuccessRef.current = onSuccess
  })

  const [state, formAction, isPending] = useActionState(
    async (prev: KidActionState, formData: FormData) => {
      const result = await action(prev, formData)
      if (result.success) {
        setFirstName(defaults?.firstName ?? '')
        setLastName(defaults?.lastName ?? '')
        setGender(defaults?.gender ?? null)
        onSuccessRef.current?.()
      }
      return result
    },
    { error: null },
  )

  return (
    <form action={formAction} className="space-y-3">
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className={cn('grid grid-cols-1 gap-3', !stacked && 'sm:grid-cols-2')}>
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-firstName`}>First name</Label>
          <Input id={`${uid}-firstName`} name="firstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-lastName`}>Last name</Label>
          <Input id={`${uid}-lastName`} name="lastName" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Gender</legend>
        <div className="flex gap-4 text-sm">
          {(['MALE', 'FEMALE'] as const).map((g) => (
            <label key={g} className="flex items-center gap-2">
              <input type="radio" name="gender" value={g} required checked={gender === g} onChange={() => setGender(g)} />
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
