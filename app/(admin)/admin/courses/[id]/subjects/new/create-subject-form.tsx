'use client'

import { useActionState } from 'react'
import { createSubjectAction } from '../../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'

type Props = { courseId: string; nextOrder: number }

export function CreateSubjectForm({ courseId, nextOrder }: Props) {
  const [state, formAction, isPending] = useActionState(createSubjectAction, { error: null })
  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="courseId" value={courseId} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subject-title">Title <span aria-hidden="true">*</span></Label>
              <Input id="subject-title" name="title" required placeholder="e.g. Introduction to Tajweed" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject-order">Order</Label>
              <Input id="subject-order" name="order" type="number" min="1" defaultValue={String(nextOrder)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subject-description">Description</Label>
              <Textarea id="subject-description" name="description" rows={2} placeholder="Brief description..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject-units">Units</Label>
              <Input id="subject-units" name="units" type="number" min="1" defaultValue="1" />
            </div>
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Creating...' : 'Create Subject'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
