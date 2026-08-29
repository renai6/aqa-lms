'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { submitAttemptAction } from '../../../actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { QuestionMedia } from '@/components/assessments/question-media'

type TakeOption = { id: string; label: string; value: string }
type TakeQuestion = {
  id: string
  questionText: string
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'ESSAY'
  points: number
  order: number
  mediaType: 'AUDIO' | 'IMAGE' | null
  mediaUrl: string | null
  options: TakeOption[]
}

type Props = {
  attemptId: string
  assessmentTitle: string
  questions: TakeQuestion[]
  deadline: string | null
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function AttemptForm({ attemptId, assessmentTitle, questions, deadline }: Props) {
  const [state, action, pending] = useActionState(submitAttemptAction, { error: null })
  const formRef = useRef<HTMLFormElement>(null)
  const autoSubmitted = useRef(false)

  const deadlineMs = deadline ? new Date(deadline).getTime() : null
  // Starts null and is filled by the effect's first tick after mount, avoiding
  // an impure Date.now() during render (and a hydration mismatch).
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (deadlineMs == null) return
    const tick = () => {
      const left = deadlineMs - Date.now()
      setRemaining(left)
      // Timer is display-only; on expiry we auto-submit whatever exists (D2).
      if (left <= 0 && !autoSubmitted.current) {
        autoSubmitted.current = true
        formRef.current?.requestSubmit()
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [deadlineMs])

  return (
    <form ref={formRef} action={action} className="space-y-6">
      <input type="hidden" name="attemptId" value={attemptId} />

      {/* Sticky header with title + timer */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-border">
        <h1 className="text-lg font-bold tracking-tight truncate">{assessmentTitle}</h1>
        {remaining != null && (
          <span
            className={
              'inline-flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1 text-sm font-semibold tabular-nums ' +
              (remaining <= 60_000
                ? 'bg-red-50 text-red-600'
                : 'bg-muted text-foreground')
            }
          >
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            {formatRemaining(remaining)}
          </span>
        )}
      </div>

      <div className="space-y-5">
        {questions.map((q, i) => (
          <fieldset key={q.id} className="rounded-xl border border-border bg-white p-5 space-y-3">
            <legend className="sr-only">Question {i + 1}</legend>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium">
                <span className="text-muted-foreground">{i + 1}.</span> {q.questionText}
              </p>
              <span className="shrink-0 text-xs text-muted-foreground">
                {q.points} {q.points === 1 ? 'pt' : 'pts'}
              </span>
            </div>

            <QuestionMedia type={q.mediaType} url={q.mediaUrl} />

            {q.type === 'ESSAY' ? (
              <Textarea
                name={'answer_' + q.id}
                rows={5}
                placeholder="Type your answer…"
                disabled={pending}
              />
            ) : (
              <div className="space-y-1.5">
                {q.options.map(o => (
                  <label
                    key={o.id}
                    className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/60 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <input
                      type="radio"
                      name={'answer_' + q.id}
                      value={o.value}
                      disabled={pending}
                      className="accent-primary"
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        ))}
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Submitting…' : 'Submit assessment'}
        </Button>
      </div>
    </form>
  )
}
