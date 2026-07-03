'use client'

import { useActionState } from 'react'
import { createAssessmentAction } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

type Props = { subjectId: string; courseId: string }

export function CreateAssessmentForm({ subjectId, courseId }: Props) {
  const [state, formAction, isPending] = useActionState(createAssessmentAction, { error: null })
  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="subjectId" value={subjectId} />
          <input type="hidden" name="courseId" value={courseId} />
          <div className="space-y-2">
            <Label htmlFor="assess-title">Title <span aria-hidden="true">*</span></Label>
            <Input id="assess-title" name="title" required placeholder="e.g. Midterm Quiz" />
          </div>
          <div className="space-y-2">
            <Label>Type <span aria-hidden="true">*</span></Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="type" value="QUIZ" defaultChecked className="accent-primary" />
                Quiz
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="type" value="EXAM" className="accent-primary" />
                Exam
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assess-duration">Duration (mins)</Label>
              <Input id="assess-duration" name="durationMins" type="number" min="1" placeholder="e.g. 60" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assess-passing">Passing Score (%)</Label>
              <Input id="assess-passing" name="passingScore" type="number" min="0" max="100" placeholder="e.g. 75" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assess-attempts">Max Attempts</Label>
              <Input id="assess-attempts" name="maxAttempts" type="number" min="1" placeholder="e.g. 3" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assess-weight">Weight</Label>
            <Input id="assess-weight" name="weight" type="number" min="0.01" step="0.01" defaultValue="1" />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Creating...' : 'Create Assessment'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
