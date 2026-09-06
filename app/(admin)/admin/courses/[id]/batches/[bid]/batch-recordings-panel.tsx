'use client'

import { useActionState, useState } from 'react'
import { Plus, Trash2, ExternalLink } from 'lucide-react'
import { addBatchRecordingAction, removeBatchRecordingAction } from '@/lib/batches/actions'
import { formatRecordingDate } from '@/lib/batches/recording-date'
import type { BatchRecordingRow } from '@/lib/batches/queries'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

type Props = {
  batchId: string
  courseId: string
  subjectId: string
  recordings: BatchRecordingRow[]
}

export function BatchRecordingsPanel({ batchId, courseId, subjectId, recordings }: Props) {
  const [isAdding, setIsAdding] = useState(false)
  const [addState, addAction, addPending] = useActionState(addBatchRecordingAction, { error: null })
  const [removeState, removeAction, removePending] = useActionState(removeBatchRecordingAction, {
    error: null,
  })

  return (
    <div className="mt-4 pt-4 border-t space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Recordings</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => setIsAdding((v) => !v)}
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          New
        </Button>
      </div>

      {/* The form stays open after a successful add - React clears the inputs
          itself, and admins typically post a run of sessions at once. */}
      {isAdding && (
        <form
          action={addAction}
          className="flex flex-col sm:flex-row sm:items-end gap-2 p-3 rounded-md bg-muted/40"
        >
          <input type="hidden" name="batchId" value={batchId} />
          <input type="hidden" name="subjectId" value={subjectId} />
          <input type="hidden" name="courseId" value={courseId} />
          <div className="space-y-1 sm:w-40">
            <Label className="text-xs text-muted-foreground">Date</Label>
            <Input type="date" name="date" required className="text-sm h-8" />
          </div>
          <div className="space-y-1 sm:w-48">
            <Label className="text-xs text-muted-foreground">Title (optional)</Label>
            <Input name="title" placeholder="Makeup session…" className="text-sm h-8" />
          </div>
          <div className="space-y-1 flex-1">
            <Label className="text-xs text-muted-foreground">Recording URL</Label>
            <Input name="url" placeholder="Google Drive link…" required className="text-sm h-8" />
          </div>
          <Button type="submit" size="sm" disabled={addPending} className="h-8">
            {addPending ? 'Adding…' : 'Add'}
          </Button>
        </form>
      )}

      {addState.error && <p className="text-xs text-destructive">{addState.error}</p>}
      {removeState.error && <p className="text-xs text-destructive">{removeState.error}</p>}

      {recordings.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No recordings for this subject in this batch yet.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {recordings.map((recording) => (
            <li key={recording.id} className="flex items-center gap-3 px-3 py-2">
              <span className="text-sm font-medium w-36 shrink-0">
                {formatRecordingDate(recording.date)}
              </span>
              <span className="flex-1 text-sm text-muted-foreground truncate">
                {recording.title}
              </span>
              <a
                href={recording.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
                aria-label="Open recording"
              >
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
              </a>
              <form action={removeAction}>
                <input type="hidden" name="recordingId" value={recording.id} />
                <input type="hidden" name="batchId" value={batchId} />
                <input type="hidden" name="courseId" value={courseId} />
                <Button
                  type="submit"
                  size="sm"
                  variant="ghost"
                  disabled={removePending}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  aria-label={'Delete recording from ' + formatRecordingDate(recording.date)}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
