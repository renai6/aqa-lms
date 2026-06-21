'use client'

import { useActionState, useRef, useEffect } from 'react'
import { createSubjectAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Props = { courseId: string; nextOrder: number }

export function AddSubjectForm({ courseId, nextOrder }: Props) {
  const [state, formAction, isPending] = useActionState(createSubjectAction, { error: null })
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.success) formRef.current?.reset()
  }, [state.success])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Subject</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="courseId" value={courseId} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subject-title">
                Title <span aria-hidden="true">*</span>
              </Label>
              <Input
                id="subject-title"
                name="title"
                required
                placeholder="e.g. Introduction to Tajweed"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject-order">Order</Label>
              <Input
                id="subject-order"
                name="order"
                type="number"
                min="1"
                defaultValue={String(nextOrder)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subject-description">Description</Label>
              <Textarea
                id="subject-description"
                name="description"
                rows={2}
                placeholder="Brief description..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject-units">Units</Label>
              <Input
                id="subject-units"
                name="units"
                type="number"
                min="1"
                defaultValue="1"
              />
            </div>
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state.success && !state.error && (
            <p className="text-sm text-green-600">Subject added.</p>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Adding...' : 'Add Subject'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
