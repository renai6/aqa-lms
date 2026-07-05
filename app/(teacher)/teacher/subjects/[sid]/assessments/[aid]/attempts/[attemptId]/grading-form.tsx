'use client'

import { useActionState } from 'react'
import { finalizeAttemptGradingAction } from '@/lib/teacher/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { AttemptForGrading } from '@/lib/teacher/queries'

type Props = {
  attempt: AttemptForGrading
  subjectId: string
  basePath: string
}

function optionLabel(
  q: AttemptForGrading['questions'][number],
  value: string | null,
): string {
  if (value == null || value === '') return '(no answer)'
  const opt = q.options.find((o) => o.value === value)
  return opt ? opt.label : value
}

export function GradingForm({ attempt, subjectId, basePath }: Props) {
  const [state, formAction, isPending] = useActionState(
    finalizeAttemptGradingAction,
    { error: null },
  )
  const isGraded = attempt.status === 'GRADED'

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="attemptId" value={attempt.id} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <input type="hidden" name="basePath" value={basePath} />

      {attempt.questions.map((q, i) => {
        const isEssay = q.type === 'ESSAY'
        return (
          <Card key={q.id}>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-muted-foreground text-xs tracking-wide uppercase">
                    Question {i + 1} ·{' '}
                    {q.type === 'MULTIPLE_CHOICE'
                      ? 'Multiple Choice'
                      : q.type === 'TRUE_FALSE'
                        ? 'True / False'
                        : 'Essay'}{' '}
                    · {q.points} pts
                  </p>
                  <p className="mt-1 font-medium">{q.questionText}</p>
                </div>
              </div>

              {isEssay ? (
                <div className="space-y-3">
                  <div className="bg-muted/40 rounded-md border px-3 py-2 text-sm whitespace-pre-wrap">
                    {q.answer && q.answer.trim() !== '' ? (
                      q.answer
                    ) : (
                      <span className="text-muted-foreground italic">
                        (no answer)
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr]">
                    <div className="space-y-1.5">
                      <Label htmlFor={'points_' + q.id}>
                        Points (0–{q.points})
                      </Label>
                      <Input
                        id={'points_' + q.id}
                        name={'points_' + q.id}
                        type="number"
                        min="0"
                        max={q.points}
                        step="0.5"
                        defaultValue={q.pointsEarned ?? ''}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={'feedback_' + q.id}>
                        Feedback (optional)
                      </Label>
                      <Textarea
                        id={'feedback_' + q.id}
                        name={'feedback_' + q.id}
                        rows={2}
                        defaultValue={q.feedback ?? ''}
                        placeholder="Comments for the student…"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Answer:</span>
                  <span className="font-medium">
                    {optionLabel(q, q.answer)}
                  </span>
                  {q.isCorrect === true && (
                    <Badge
                      variant="outline"
                      className="border-green-300 bg-green-50 text-green-700"
                    >
                      Correct
                    </Badge>
                  )}
                  {q.isCorrect === false && (
                    <Badge
                      variant="outline"
                      className="text-destructive border-destructive/30 bg-destructive/5"
                    >
                      Incorrect
                    </Badge>
                  )}
                  <span className="text-muted-foreground ml-auto">
                    {q.pointsEarned ?? 0} / {q.points} pts
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}

      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : isGraded ? 'Update Grade' : 'Finalize Grade'}
        </Button>
        {isGraded && (
          <span className="text-muted-foreground text-sm">
            Currently graded
            {attempt.score != null
              ? ' · ' + attempt.score.toFixed(1) + '%'
              : ''}
          </span>
        )}
      </div>
    </form>
  )
}
