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
  videoUrl: string | null
  audioUrl: string | null
  pptUrl: string | null
}

export function BatchLessonForm({
  batchId,
  courseId,
  lessonId,
  lessonTitle,
  lessonOrder,
  materialUrl,
  videoUrl,
  audioUrl,
  pptUrl,
}: Props) {
  const [state, action, isPending] = useActionState(upsertBatchLessonContentAction, { error: null })

  return (
    <div className="py-3 border-b last:border-b-0 space-y-2">
      <p className="text-sm font-medium">
        <span className="text-muted-foreground mr-2">{lessonOrder}.</span>
        {lessonTitle}
      </p>
      <form action={action} className="flex flex-col sm:flex-row sm:items-end gap-2">
        <input type="hidden" name="batchId" value={batchId} />
        <input type="hidden" name="lessonId" value={lessonId} />
        <input type="hidden" name="courseId" value={courseId} />
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
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
            <Label className="text-xs text-muted-foreground">Lesson Video URL</Label>
            <Input
              name="videoUrl"
              defaultValue={videoUrl ?? ''}
              placeholder="Google Drive link…"
              className="text-sm h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Audio URL</Label>
            <Input
              name="audioUrl"
              defaultValue={audioUrl ?? ''}
              placeholder="Google Drive link…"
              className="text-sm h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">PowerPoint URL</Label>
            <Input
              name="pptUrl"
              defaultValue={pptUrl ?? ''}
              placeholder="Slides link…"
              className="text-sm h-8"
            />
          </div>
        </div>
        {/* The Save/error status renders below the form, not beside the button,
            so a long validation message cannot squeeze the inputs. */}
        <Button type="submit" size="sm" disabled={isPending} className="h-8 shrink-0">
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </form>
      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : state.success ? (
        <p className="text-xs text-green-600">Saved</p>
      ) : null}
      <p className="text-[11px] leading-tight text-muted-foreground">
        Lesson video and audio: Set Drive sharing to Viewer, and turn off download/print/copy.
      </p>
    </div>
  )
}
