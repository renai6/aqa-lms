'use client'

import { useActionState } from 'react'
import { upsertBatchLessonContentAction } from '@/lib/batches/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

type Props = {
  batchId: string
  courseId: string
  lessonId: string
  lessonTitle: string
  lessonOrder: number
  materialUrl: string | null
  recordingUrl: string | null
}

export function BatchLessonForm({
  batchId,
  courseId,
  lessonId,
  lessonTitle,
  lessonOrder,
  materialUrl,
  recordingUrl,
}: Props) {
  const [state, action, isPending] = useActionState(upsertBatchLessonContentAction, { error: null })

  return (
    <div className="py-3 border-b last:border-b-0 space-y-2">
      <p className="text-sm font-medium">
        <span className="text-muted-foreground mr-2">{lessonOrder}.</span>
        {lessonTitle}
      </p>
      <form action={action} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <input type="hidden" name="batchId" value={batchId} />
        <input type="hidden" name="lessonId" value={lessonId} />
        <input type="hidden" name="courseId" value={courseId} />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Material URL</Label>
          <Input
            name="materialUrl"
            defaultValue={materialUrl ?? ''}
            placeholder="Google Drive link…"
            className="text-sm h-8"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Recording URL</Label>
          <Input
            name="recordingUrl"
            defaultValue={recordingUrl ?? ''}
            placeholder="Google Drive link…"
            className="text-sm h-8"
          />
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button type="submit" size="sm" disabled={isPending} className="h-8">
            {isPending ? 'Saving…' : 'Save'}
          </Button>
          {state.success && !state.error && (
            <span className="text-xs text-green-600">Saved</span>
          )}
          {state.error && (
            <span className="text-xs text-destructive">{state.error}</span>
          )}
        </div>
      </form>
    </div>
  )
}
