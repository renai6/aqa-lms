'use client'

import { useActionState, useState } from 'react'
import { ExternalLink, PlayCircle } from 'lucide-react'
import { setBatchRecordingFolderAction } from '@/lib/batches/actions'
import { driveFolderUrl } from '@/lib/batches/drive'
import type { FolderListing } from '@/lib/batches/drive-folder'
import type { BatchRecordingRow } from '@/lib/batches/queries'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { BatchRecordingLinks } from './batch-recording-links'

type Props = {
  batchId: string
  courseId: string
  subjectId: string
  folderId: string | null
  // null when no folder is set.
  listing: FolderListing | null
  links: BatchRecordingRow[]
}

export function BatchRecordingsPanel({
  batchId,
  courseId,
  subjectId,
  folderId,
  listing,
  links,
}: Props) {
  const [state, action, isPending] = useActionState(setBatchRecordingFolderAction, { error: null })
  // Controlled so a rejected link stays in the box for the admin to fix,
  // instead of React's post-submit reset putting the old one back.
  const [folderUrl, setFolderUrl] = useState(folderId ? driveFolderUrl(folderId) : '')

  return (
    <div className="mt-4 pt-4 border-t space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Recordings</h3>
        {folderId && (
          <a
            href={driveFolderUrl(folderId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Open folder
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        )}
      </div>

      <form action={action} className="flex flex-col sm:flex-row sm:items-end gap-2">
        <input type="hidden" name="batchId" value={batchId} />
        <input type="hidden" name="subjectId" value={subjectId} />
        <input type="hidden" name="courseId" value={courseId} />
        <div className="space-y-1 flex-1">
          <Label className="text-xs text-muted-foreground">Google Drive folder</Label>
          <Input
            name="folderUrl"
            value={folderUrl}
            onChange={(e) => setFolderUrl(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/…"
            className="text-sm h-8"
          />
        </div>
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
        Share the folder as &quot;Anyone with the link&quot;. Once set, every video in it is shown to
        this batch instead of the individual links below, newest upload first, and new uploads
        appear within a few minutes. Clear the link and save to go back to the individual links.
      </p>

      {listing &&
        (!listing.ok ? (
          <p className="text-xs text-destructive">
            {listing.reason === 'not-found'
              ? 'Google Drive cannot open this folder, so students see no recordings. Check that it still exists and is shared as "Anyone with the link".'
              : 'Google Drive could not be reached, so the recordings cannot be shown right now.'}
          </p>
        ) : listing.recordings.length === 0 ? (
          <p className="text-xs text-muted-foreground">No videos in this folder yet.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {listing.recordings.map((recording) => (
              <li key={recording.id} className="flex items-center gap-3 px-3 py-2">
                <PlayCircle className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1 text-sm truncate">{recording.title}</span>
                <a
                  href={recording.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={'Open ' + recording.title}
                >
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        ))}

      <BatchRecordingLinks
        batchId={batchId}
        courseId={courseId}
        subjectId={subjectId}
        recordings={links}
        hasFolder={folderId !== null}
      />
    </div>
  )
}
