'use client'

import { useActionState } from 'react'
import { updateSubjectAction } from '../../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SubjectDetail } from '@/lib/courses/queries'

type Props = { subject: SubjectDetail }

export function EditSubjectForm({ subject }: Props) {
  const [state, formAction, isPending] = useActionState(updateSubjectAction, { error: null })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Subject Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={subject.id} />
          <input type="hidden" name="courseId" value={subject.courseId} />
          {/* Once a re-gender warning has been shown, the next submit confirms it. */}
          <input type="hidden" name="confirm" value={state.warning ? 'true' : 'false'} />
          <div className="space-y-2">
            <Label htmlFor="sub-title">Title</Label>
            <Input id="sub-title" name="title" required defaultValue={subject.title} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sub-description">Description</Label>
            <Textarea
              id="sub-description"
              name="description"
              rows={3}
              defaultValue={subject.description ?? ''}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sub-order">Order</Label>
              <Input
                id="sub-order"
                name="order"
                type="number"
                min="1"
                defaultValue={String(subject.order)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-units">Units</Label>
              <Input
                id="sub-units"
                name="units"
                type="number"
                min="1"
                defaultValue={String(subject.units)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sub-gender">Visible to</Label>
            <select
              id="sub-gender"
              name="gender"
              defaultValue={subject.gender ?? ''}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Everyone</option>
              <option value="MALE">Male only</option>
              <option value="FEMALE">Female only</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Restrict this subject so only students of the selected gender can see it.
            </p>
          </div>
          {state.warning && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {state.warning}
            </p>
          )}
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state.success && !state.error && (
            <p className="text-sm text-green-600">Saved successfully.</p>
          )}
          <Button type="submit" disabled={isPending} variant={state.warning ? 'destructive' : 'default'}>
            {isPending
              ? 'Saving...'
              : state.warning
                ? 'Confirm change'
                : 'Save Changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
