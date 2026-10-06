export function toPreviewUrl(url: string): string | null {
  const match = url.match(/\/file\/d\/([^/]+)/)
  if (!match) return null
  return `https://drive.google.com/file/d/${match[1]}/preview`
}

const FOLDER_PATH = /\/folders\/([A-Za-z0-9_-]+)/
export const FOLDER_ID = /^[A-Za-z0-9_-]+$/

/** Returns the Drive folder ID for a folder share link, or null if it is not one. */
export function parseDriveFolderId(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return null
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== 'drive.google.com') return null

  const fromPath = FOLDER_PATH.exec(parsed.pathname)?.[1]
  if (fromPath) return fromPath

  // The older "open?id=" share shape.
  const fromQuery = parsed.searchParams.get('id')
  if (parsed.pathname === '/open' && fromQuery && FOLDER_ID.test(fromQuery)) return fromQuery

  return null
}

export function driveFolderUrl(folderId: string): string {
  return 'https://drive.google.com/drive/folders/' + folderId
}
