'use client'
import { useActionState } from 'react'
import { updateLessonAction } from '../../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LessonDetail } from '@/lib/courses/queries'

type Props = { lesson: LessonDetail; courseId: string }

export function EditLessonForm({ lesson, courseId }: Props) {
  const [state, formAction, isPending] = useActionState(updateLessonAction, { error: null as string | null, success: false })
  return (
    <Card>
      <CardHeader><CardTitle>Lesson Details</CardTitle></CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={lesson.id} />
          <input type="hidden" name="subjectId" value={lesson.subjectId} />
          <input type="hidden" name="courseId" value={courseId} />
          <div className="space-y-2">
            <Label htmlFor="lesson-title">Title</Label>
            <Input id="lesson-title" name="title" required defaultValue={lesson.title} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lesson-description">Description</Label>
            <Textarea id="lesson-description" name="description" rows={3} defaultValue={lesson.description ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lesson-order">Order</Label>
            <Input id="lesson-order" name="order" type="number" min="1" defaultValue={String(lesson.order)} />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state.success && !state.error && <p className="text-sm text-green-600">Saved successfully.</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
