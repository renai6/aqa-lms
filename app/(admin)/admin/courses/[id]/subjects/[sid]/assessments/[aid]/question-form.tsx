'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { createQuestionAction, updateQuestionAction } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import type { QuestionDetail } from '@/lib/assessments/queries'

type Props = {
  assessmentId: string
  subjectId: string
  courseId: string
  locked: boolean
  question?: QuestionDetail
}

export function QuestionForm({ assessmentId, subjectId, courseId, locked, question }: Props) {
  const isEdit = !!question

  const initialType = question?.type ?? 'MULTIPLE_CHOICE'
  const initialTfCorrect = question?.options.find(o => o.isCorrect)?.value ?? ''
  const initialOptions = question?.type === 'MULTIPLE_CHOICE'
    ? question.options.map(o => o.label)
    : ['', '']
  const initialCorrectIndex = question?.type === 'MULTIPLE_CHOICE'
    ? question.options.findIndex(o => o.isCorrect)
    : -1

  const [type, setType] = useState<string>(initialType)
  const [options, setOptions] = useState<string[]>(
    initialType === 'MULTIPLE_CHOICE' ? initialOptions : ['', '']
  )
  const [correctIndex, setCorrectIndex] = useState<number>(initialCorrectIndex)

  const [state, formAction, isPending] = useActionState(
    isEdit ? updateQuestionAction : createQuestionAction,
    { error: null },
  )

  function addOption() {
    if (options.length < 6) setOptions([...options, ''])
  }

  function removeOption(i: number) {
    const next = options.filter((_, idx) => idx !== i)
    setOptions(next)
    if (correctIndex === i) setCorrectIndex(-1)
    else if (correctIndex > i) setCorrectIndex(correctIndex - 1)
  }

  function updateOption(i: number, val: string) {
    const next = [...options]
    next[i] = val
    setOptions(next)
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {locked && (
          <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            Questions are locked because students have attempted this assessment.
          </div>
        )}
        <form action={formAction} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={question.id} />}
          <input type="hidden" name="assessmentId" value={assessmentId} />
          <input type="hidden" name="subjectId" value={subjectId} />
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="type" value={type} />

          <div className="space-y-2">
            <Label>Question Type</Label>
            <div className="flex gap-4 flex-wrap">
              {(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'ESSAY'] as const).map(t => (
                <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="_typeDisplay"
                    value={t}
                    checked={type === t}
                    onChange={() => setType(t)}
                    disabled={locked}
                    className="accent-primary"
                  />
                  {t === 'MULTIPLE_CHOICE' ? 'Multiple Choice' : t === 'TRUE_FALSE' ? 'True / False' : 'Essay'}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="q-text">Question Text <span aria-hidden="true">*</span></Label>
            <Textarea
              id="q-text"
              name="questionText"
              required
              rows={3}
              disabled={locked}
              defaultValue={question?.questionText ?? ''}
              placeholder="Enter the question..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="q-points">Points <span aria-hidden="true">*</span></Label>
            <Input
              id="q-points"
              name="points"
              type="number"
              min="1"
              required
              disabled={locked}
              defaultValue={question?.points ?? 1}
              className="max-w-[120px]"
            />
          </div>

          {type === 'MULTIPLE_CHOICE' && (
            <div className="space-y-3">
              <Label>Answer Options</Label>
              <input type="hidden" name="correctIndex" value={correctIndex >= 0 ? correctIndex : ''} />
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="_correct"
                    checked={correctIndex === i}
                    onChange={() => setCorrectIndex(i)}
                    disabled={locked}
                    aria-label={'Mark option ' + (i + 1) + ' as correct'}
                    className="accent-primary shrink-0"
                  />
                  <Input
                    name="optionText"
                    value={opt}
                    onChange={e => updateOption(i, e.target.value)}
                    disabled={locked}
                    placeholder={'Option ' + (i + 1)}
                    required
                  />
                  {!locked && options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOption(i)}
                      className="text-destructive hover:text-destructive shrink-0"
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              {!locked && options.length < 6 && (
                <Button type="button" variant="outline" size="sm" onClick={addOption}>
                  Add Option
                </Button>
              )}
            </div>
          )}

          {type === 'TRUE_FALSE' && (
            <div className="space-y-2">
              <Label>Correct Answer</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="tfCorrect"
                    value="true"
                    defaultChecked={initialTfCorrect === 'true'}
                    disabled={locked}
                    className="accent-primary"
                  />
                  True
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="tfCorrect"
                    value="false"
                    defaultChecked={initialTfCorrect === 'false'}
                    disabled={locked}
                    className="accent-primary"
                  />
                  False
                </label>
              </div>
            </div>
          )}

          {type === 'ESSAY' && (
            <p className="text-sm text-muted-foreground italic">Essay questions are graded manually.</p>
          )}

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state.success && !state.error && <p className="text-sm text-green-600">Saved successfully.</p>}
          {!locked && (
            <Button type="submit" disabled={isPending}>
              {isPending ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? 'Save Changes' : 'Create Question')}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
