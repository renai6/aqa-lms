// Google Drive share links cannot be fed to <audio>/<img>: Drive redirects and
// blocks hotlinking. The only reliable embed is the /preview page in an iframe,
// which needs the bare file ID pulled out of whatever link shape the admin pastes.

const DRIVE_HOSTS = ['drive.google.com', 'docs.google.com']
const FILE_PATH = /^\/file\/d\/([A-Za-z0-9_-]+)/
const FILE_ID = /^[A-Za-z0-9_-]+$/

/** Returns the Drive file ID for a share link, or null if it is not one. */
export function extractDriveFileId(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return null
  }

  if (parsed.protocol !== 'https:') return null
  if (!DRIVE_HOSTS.includes(parsed.hostname)) return null

  const fromPath = FILE_PATH.exec(parsed.pathname)?.[1]
  if (fromPath) return fromPath

  const fromQuery = parsed.searchParams.get('id')
  if (fromQuery && FILE_ID.test(fromQuery)) return fromQuery

  return null
}

/** The embeddable Drive viewer/player URL for a file ID. */
export function driveEmbedUrl(fileId: string): string {
  return 'https://drive.google.com/file/d/' + fileId + '/preview'
}

export type QuestionMediaInput = {
  mediaType: 'AUDIO' | 'IMAGE' | null
  mediaUrl: string | null
}

const MEDIA_TYPES = ['AUDIO', 'IMAGE'] as const

/**
 * Reads the optional media fields off a question form. Returns the columns to
 * write, or an error message for the action to surface. Picking 'NONE' clears
 * any media the question previously carried.
 */
export function parseMedia(formData: FormData): QuestionMediaInput | string {
  const rawType = formData.get('mediaType')
  if (typeof rawType !== 'string' || rawType === '' || rawType === 'NONE') {
    return { mediaType: null, mediaUrl: null }
  }

  const mediaType = MEDIA_TYPES.find((t) => t === rawType)
  if (!mediaType) return 'Unrecognised media type.'

  const rawUrl = formData.get('mediaUrl')
  const mediaUrl = typeof rawUrl === 'string' ? rawUrl.trim() : ''
  if (!extractDriveFileId(mediaUrl)) {
    return 'Enter a valid Google Drive file link, or set Media to None.'
  }

  return { mediaType, mediaUrl }
}
