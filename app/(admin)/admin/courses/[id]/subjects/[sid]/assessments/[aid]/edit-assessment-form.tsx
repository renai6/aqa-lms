'use client'

import { useActionState } from 'react'
import { updateAssessmentAction } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AssessmentDetail } from '@/lib/assessments/queries'

type Props = { assessment: AssessmentDetail }

export function EditAssessmentForm({ assessment }: Props) {
  const [state, formAction, isPending] = useActionState(updateAssessmentAction, { error: null })
  return (
    <Card>
      <CardHeader><CardTitle>Assessment Settings</CardTitle></CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={assessment.id} />
          <input type="hidden" name="subjectId" value={assessment.subjectId} />
          <input type="hidden" name="courseId" value={assessment.subject.courseId} />
          <div className="space-y-2">
            <Label htmlFor="assess-title">Title</Label>
            <Input id="assess-title" name="title" required defaultValue={assessment.title} />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="type" value="QUIZ" defaultChecked={assessment.type === 'QUIZ'} className="accent-primary" />
                Quiz
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="type" value="EXAM" defaultChecked={assessment.type === 'EXAM'} className="accent-primary" />
                Exam
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assess-duration">Duration (mins)</Label>
              <Input
                id="assess-duration"
                name="durationMins"
                type="number"
                min="1"
                defaultValue={assessment.durationMins ?? ''}
                placeholder="e.g. 60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assess-passing">Passing Score (%)</Label>
              <Input
                id="assess-passing"
                name="passingScore"
                type="number"
                min="0"
                max="100"
                defaultValue={assessment.passingScore ?? ''}
                placeholder="e.g. 75"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assess-attempts">Max Attempts</Label>
              <Input
                id="assess-attempts"
                name="maxAttempts"
                type="number"
                min="1"
                defaultValue={assessment.maxAttempts ?? ''}
                placeholder="e.g. 3"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assess-weight">Weight</Label>
            <Input
              id="assess-weight"
              name="weight"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={assessment.weight}
            />
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
