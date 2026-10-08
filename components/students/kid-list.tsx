'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { KidForm } from '@/components/students/kid-form'
import type { KidActionState, KidListItem } from '@/lib/students/dependents'

type Action = (prev: KidActionState, formData: FormData) => Promise<KidActionState>

type Props = {
  kids: KidListItem[]
  updateAction: Action
  removeAction: Action
  hidden?: Record<string, string>
  // Admin only: makes each name a link to that kid's student page.
  linkBase?: string
}

export function KidList({ kids, updateAction, removeAction, hidden, linkBase }: Props) {
  if (kids.length === 0) return <p className="text-muted-foreground text-sm">No kids yet.</p>
  return (
    <ul className="divide-y rounded-lg border">
      {kids.map((kid) => (
        <KidRow key={kid.id} kid={kid} updateAction={updateAction} removeAction={removeAction} hidden={hidden} linkBase={linkBase} />
      ))}
    </ul>
  )
}

function KidRow({ kid, updateAction, removeAction, hidden, linkBase }: Omit<Props, 'kids'> & { kid: KidListItem }) {
  const [editing, setEditing] = useState(false)
  const [removeState, removeFormAction, removing] = useActionState(removeAction, { error: null })
  const name = `${kid.firstName} ${kid.lastName}`
  const fields = { ...hidden, kidId: kid.id }
  const formId = `remove-kid-${kid.id}`

  return (
    <li className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">
            {linkBase ? (
              <Link href={linkBase + kid.id} className="hover:underline">
                {name}
              </Link>
            ) : (
              name
            )}
          </p>
          {!kid.isActive && <p className="text-muted-foreground text-xs">Deactivated by the academy</p>}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Cancel' : 'Edit'}
          </Button>
          {!kid.hasHistory && (
            <>
              {/* AlertDialogContent renders into document.body, outside this form, so the
                  confirm button cannot be a descendant of it - the form={formId} attribute
                  on that button is what associates them, and must not be removed. */}
              <form action={removeFormAction} id={formId}>
                {Object.entries(fields).map(([n, v]) => (
                  <input key={n} type="hidden" name={n} value={v} />
                ))}
              </form>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm" disabled={removing} className="text-destructive hover:text-destructive">
                    {removing ? 'Removing...' : 'Remove'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{`Remove ${name}?`}</AlertDialogTitle>
                    <AlertDialogDescription>This deletes the kid profile. You can add it again later.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction type="submit" form={formId}>
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>
      {removeState.error && <p className="text-destructive text-sm">{removeState.error}</p>}
      {editing && (
        <KidForm
          action={updateAction}
          submitLabel="Save"
          hidden={fields}
          defaults={{ firstName: kid.firstName, lastName: kid.lastName, gender: kid.gender }}
          onSuccess={() => setEditing(false)}
        />
      )}
    </li>
  )
}
