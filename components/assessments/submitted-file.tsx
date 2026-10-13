import { ExternalLink } from 'lucide-react'
import { extractDriveFileId } from '@/lib/assessments/media'

/**
 * The student's answer to a file-upload question: a link to the file they put
 * in the Drive folder. Only a Drive file link is ever rendered as a link, so a
 * stored answer can never become a javascript: or off-site href.
 */
export function SubmittedFile({ url }: { url: string | null }) {
  if (!url || !extractDriveFileId(url)) {
    return <p className="text-sm text-muted-foreground italic">No file submitted.</p>
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
    >
      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
      Open submitted file
    </a>
  )
}
