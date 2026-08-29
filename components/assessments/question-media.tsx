import { extractDriveFileId, driveEmbedUrl } from '@/lib/assessments/media'

type Props = {
  type: 'AUDIO' | 'IMAGE' | null
  url: string | null
}

// Audio needs only Drive's compact player bar; an image needs room to be read.
const HEIGHT = { AUDIO: 'h-20', IMAGE: 'h-[400px]' } as const

/**
 * Embeds a Google Drive file next to a question. Renders nothing when there is
 * no media or the link is not a Drive file, so callers need no guard of their own.
 *
 * The wrapper owns the border and clipping: Drive paints the player's own dark
 * background to the frame's edges, which squares off the corners if the radius
 * lives on the iframe itself.
 */
export function QuestionMedia({ type, url }: Props) {
  if (!type || !url) return null

  const fileId = extractDriveFileId(url)
  if (!fileId) return null

  return (
    <div className={'border-border overflow-hidden rounded-md border bg-white ' + HEIGHT[type]}>
      <iframe
        src={driveEmbedUrl(fileId)}
        title={type === 'AUDIO' ? 'Audio for this question' : 'Image for this question'}
        allow="autoplay"
        className="block h-full w-full"
      />
    </div>
  )
}
