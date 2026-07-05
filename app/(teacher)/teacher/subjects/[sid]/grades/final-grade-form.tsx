'use client'

import { useActionState } from 'react'
import { saveFinalGradeAction } from '@/lib/teacher/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = {
  subjectId: string
  studentId: string
  basePath: string
  suggestion: number | null
  savedGrade: number | null
  diverges: boolean
}

export function FinalGradeForm({
  subjectId,
  studentId,
  basePath,
  suggestion,
  savedGrade,
  diverges,
}: Props) {
  const [state, formAction, isPending] = useActionState(saveFinalGradeAction, {
    error: null,
  })

  // Pre-fill with the saved grade if present, otherwise the weighted suggestion.
  const initial = savedGrade ?? (suggestion != null ? suggestion : '')

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="subjectId" value={subjectId} />
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="basePath" value={basePath} />
      <Input
        name="finalGrade"
        type="number"
        min="0"
        max="100"
        step="0.01"
        defaultValue={initial}
        required
        aria-label="Final grade"
        className="h-8 w-24"
      />
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? 'Saving…' : 'Save'}
      </Button>
      {state.success && !state.error && (
        <span className="text-xs text-green-600">Saved</span>
      )}
      {state.error && (
        <span className="text-destructive text-xs">{state.error}</span>
      )}
      {diverges && !state.success && (
        <span
          className="text-xs text-amber-700"
          title={
            'Suggestion is now ' +
            (suggestion ?? '—') +
            ' but the saved grade is ' +
            (savedGrade ?? '—')
          }
        >
          Suggestion changed → {suggestion ?? '—'}
        </span>
      )}
    </form>
  )
}
