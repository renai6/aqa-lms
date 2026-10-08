'use client'

import { useActionState, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FindParentState, ParentMatch } from '@/lib/students/dependents'
import { findParentForLinkAdminAction, linkToParentAdminAction } from '../actions'

// Two steps: the email is looked up first and the matched parent named, so a
// typo cannot hand this student's account to another family unnoticed.
export function LinkParentForm({ kidId }: { kidId: string }) {
  const uid = useId()
  // Controlled, so a failed lookup or a cancel keeps what the admin typed.
  const [email, setEmail] = useState('')
  const [found, findAction, finding] = useActionState(findParentForLinkAdminAction, { error: null })
  // The lookup the admin cancelled. A new lookup returns a new state object, so
  // its match is shown again.
  const [cancelled, setCancelled] = useState<FindParentState | null>(null)

  if (found.parent && found !== cancelled) {
    return <ConfirmLink kidId={kidId} parent={found.parent} onCancel={() => setCancelled(found)} />
  }

  return (
    <form action={findAction} className="space-y-3">
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
      {found.error && <p className="text-destructive text-sm">{found.error}</p>}
      <Button type="submit" size="sm" disabled={finding}>
        {finding ? 'Looking up...' : 'Link to parent'}
      </Button>
    </form>
  )
}

// Mounted fresh for each match, so an error from an earlier attempt never shows
// against a different parent.
function ConfirmLink({ kidId, parent, onCancel }: { kidId: string; parent: ParentMatch; onCancel: () => void }) {
  const [state, linkAction, linking] = useActionState(linkToParentAdminAction, { error: null })

  if (state.success) {
    return <p className="text-sm">Linked to {state.parentName ?? parent.name}.</p>
  }

  return (
    <form action={linkAction} className="space-y-3">
      <input type="hidden" name="kidId" value={kidId} />
      <input type="hidden" name="parentEmail" value={parent.email} />
      <p className="text-sm break-words">
        Link <span className="font-medium">{parent.name}</span> ({parent.email}) as this student&apos;s parent?
      </p>
      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={linking}>
          {linking ? 'Linking...' : 'Confirm'}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={linking} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
