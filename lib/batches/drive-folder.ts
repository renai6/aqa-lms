import { FOLDER_ID } from './drive'

// Class recordings live in a Google Drive folder per batch and subject. The
// admin stores only the folder; its videos are listed live through the Drive
// API, so uploading a new session to the folder is all it takes to publish it.
//
// Listing uses a plain API key, which can only see what is public, so the
// folder must be shared as "Anyone with the link". The same sharing is what
// lets a student's browser play the file in the Drive /preview embed.

// Drive serves listings slowly and the folders change a few times a week, so
// a new upload taking a few minutes to appear is the right trade.
const LISTING_TTL_SECONDS = 300

export type Recording = {
  id: string
  title: string
  url: string
}

export type FolderListing =
  | { ok: true; recordings: Recording[] }
  | { ok: false; reason: 'not-found' | 'unavailable' }

// "Week 3 - Tajweed.mp4" reads better as "Week 3 - Tajweed".
function titleFromFileName(name: string): string {
  return name.replace(/\.[^./]+$/, '').trim() || name
}

type DriveFile = { id: string; name: string }
type DriveFilesPage = { files?: DriveFile[]; nextPageToken?: string }

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files'
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

// Returns null when Drive answers 404, which it does both for a folder that
// does not exist and for one that is not shared publicly.
async function driveGet<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const query = new URLSearchParams({
    ...params,
    supportsAllDrives: 'true',
    key: process.env.GOOGLE_API_KEY!,
  })
  const res = await fetch(DRIVE_FILES_API + path + '?' + query, {
    next: { revalidate: LISTING_TTL_SECONDS },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Drive API ' + res.status + ': ' + (await res.text()))
  return (await res.json()) as T
}

/** Lists the videos directly inside a public Drive folder, newest upload first. */
export async function listFolderRecordings(folderId: string): Promise<FolderListing> {
  if (!process.env.GOOGLE_API_KEY) {
    console.error('[listFolderRecordings] GOOGLE_API_KEY is not set')
    return { ok: false, reason: 'unavailable' }
  }
  if (!FOLDER_ID.test(folderId)) return { ok: false, reason: 'not-found' }

  try {
    // Listing the children of a folder the key cannot see returns an empty
    // page rather than an error, so the folder itself is checked first - an
    // unshared folder must not pass for an empty one.
    const folder = await driveGet<{ mimeType: string }>('/' + folderId, { fields: 'mimeType' })
    if (!folder || folder.mimeType !== FOLDER_MIME_TYPE) return { ok: false, reason: 'not-found' }

    const recordings: Recording[] = []
    let pageToken: string | undefined
    do {
      const page = await driveGet<DriveFilesPage>('', {
        q: `'${folderId}' in parents and trashed = false and mimeType contains 'video/'`,
        fields: 'nextPageToken, files(id, name)',
        orderBy: 'createdTime desc',
        pageSize: '1000',
        includeItemsFromAllDrives: 'true',
        ...(pageToken ? { pageToken } : {}),
      })
      if (!page) return { ok: false, reason: 'not-found' }
      for (const file of page.files ?? []) {
        recordings.push({
          id: file.id,
          title: titleFromFileName(file.name),
          url: 'https://drive.google.com/file/d/' + file.id + '/view',
        })
      }
      pageToken = page.nextPageToken
    } while (pageToken)

    return { ok: true, recordings }
  } catch (err) {
    console.error('[listFolderRecordings]', err)
    return { ok: false, reason: 'unavailable' }
  }
}
