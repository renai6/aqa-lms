import { listFolderRecordings, type Recording } from './drive-folder'
import { recordingLabel } from './recording-date'

type RecordingLink = { id: string; url: string; date: Date; title: string | null }

// A batch's recordings for a subject come from its Drive folder once an admin
// sets one, and from the individually added links until then. That lets each
// subject move to a folder on its own schedule without losing what students
// can watch today. Links are expected newest first.
//
// Returns null when the folder could not be listed.
export async function resolveRecordings(
  folderId: string | null,
  links: RecordingLink[],
): Promise<Recording[] | null> {
  if (!folderId) {
    return links.map((link) => ({ id: link.id, title: recordingLabel(link), url: link.url }))
  }
  const listing = await listFolderRecordings(folderId)
  return listing.ok ? listing.recordings : null
}
