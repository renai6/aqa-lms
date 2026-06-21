'use client'

import { useActionState, useRef, useEffect } from 'react'
import { createLessonAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Props = { subjectId: string; courseId: string; nextOrder: number }

export function AddLessonForm({ subjectId, courseId, nextOrder }: Props) {
  const [state, formAction, isPending] = useActionState(createLessonAction, { error: null })
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.success) formRef.current?.reset()
  }, [state.success])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Lesson</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="subjectId" value={subjectId} />
          <input type="hidden" name="courseId" value={courseId} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lesson-title">
                Title <span aria-hidden="true">*</span>
              </Label>
              <Input
                id="lesson-title"
                name="title"
                required
                placeholder="e.g. Lesson 1: Basics"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-order">Order</Label>
              <Input
                id="lesson-order"
                name="order"
                type="number"
                min="1"
                defaultValue={String(nextOrder)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lesson-description">Description</Label>
            <Textarea
              id="lesson-description"
              name="description"
              rows={2}
              placeholder="Brief description..."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lesson-material">Material URL</Label>
              <Input
                id="lesson-material"
                name="materialUrl"
                type="text"
                placeholder="Google Drive link..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-recording">Recording URL</Label>
              <Input
                id="lesson-recording"
                name="recordingUrl"
                type="text"
                placeholder="Google Drive link..."
              />
            </div>
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state.success && !state.error && <p className="text-sm text-green-600">Lesson added.</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Adding...' : 'Add Lesson'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
