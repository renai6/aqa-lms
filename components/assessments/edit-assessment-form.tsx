'use client'

import { useActionState } from 'react'
import { updateAssessmentAction } from '@/lib/assessments/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AssessmentDetail } from '@/lib/assessments/queries'

type Props = {
  assessment: AssessmentDetail
  basePath: string
  lessons: Array<{ id: string; title: string; order: number; hasAssessment: boolean }>
  canManageGates: boolean
}

export function EditAssessmentForm({ assessment, basePath, lessons, canManageGates }: Props) {
  const [state, formAction, isPending] = useActionState(
    updateAssessmentAction,
    { error: null },
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>Assessment Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={assessment.id} />
          <input type="hidden" name="subjectId" value={assessment.subjectId} />
          <input type="hidden" name="basePath" value={basePath} />
          <div className="space-y-2">
            <Label htmlFor="assess-title">Title</Label>
            <Input
              id="assess-title"
              name="title"
              required
              defaultValue={assessment.title}
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="type"
                  value="QUIZ"
                  defaultChecked={assessment.type === 'QUIZ'}
                  className="accent-primary"
                />
                Quiz
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="type"
                  value="EXAM"
                  defaultChecked={assessment.type === 'EXAM'}
                  className="accent-primary"
                />
                Exam
              </label>
            </div>
          </div>
          {canManageGates && (
            <div className="space-y-2">
              <Label htmlFor="assess-lesson">Gates lesson</Label>
              <select
                id="assess-lesson"
                name="lessonId"
                defaultValue={assessment.lessonId ?? ''}
                className="flex h-8 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">None - subject-level assessment</option>
                {lessons.map(l => (
                  <option key={l.id} value={l.id} disabled={l.hasAssessment}>
                    {'Lesson ' + l.order + ': ' + l.title + (l.hasAssessment ? ' (already gated)' : '')}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Students must pass this assessment before the lessons after it open. Gates
                cannot contain essay questions and need a passing score.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          {state.error && (
            <p className="text-destructive text-sm">{state.error}</p>
          )}
          {state.success && !state.error && (
            <p className="text-sm text-green-600">Saved successfully.</p>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
