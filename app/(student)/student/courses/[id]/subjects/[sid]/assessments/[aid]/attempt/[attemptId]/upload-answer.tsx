'use client'

import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { extractDriveFileId } from '@/lib/assessments/media'

type Props = {
  questionId: string
  folderUrl: string | null
  disabled: boolean
}

// A file-upload answer: the student uploads to the teacher's Drive folder in a
// new tab, then pastes the link to their own file here for the teacher to open.
export function UploadAnswer({ questionId, folderUrl, disabled }: Props) {
  const [link, setLink] = useState('')
  const invalid = link.trim() !== '' && extractDriveFileId(link) === null
  const inputId = 'answer_' + questionId
  const hintId = inputId + '_hint'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {folderUrl && (
          <Button asChild variant="outline" size="sm">
            <a href={folderUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              Open upload folder
            </a>
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          Upload your video or image there, then paste its link below.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={inputId} className="text-sm font-medium">
          Link to your uploaded file
        </label>
        {/* type="text", not "url": native URL validation would block the
            timer's auto-submit on a half-typed link. The server checks it. */}
        <Input
          id={inputId}
          name={inputId}
          type="text"
          inputMode="url"
          autoComplete="off"
          value={link}
          onChange={e => setLink(e.target.value)}
          disabled={disabled}
          placeholder="https://drive.google.com/file/d/.../view"
          aria-invalid={invalid}
          aria-describedby={hintId}
        />
        <p
          id={hintId}
          className={'text-xs ' + (invalid ? 'text-destructive' : 'text-muted-foreground')}
        >
          {invalid
            ? 'That is not a Google Drive file link.'
            : 'In Google Drive, open your file’s Share menu and choose Copy link.'}
        </p>
      </div>
    </div>
  )
}
