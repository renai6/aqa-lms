import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Announcement images share the public course images bucket, kept apart by
// the announcements/ prefix. Every upload gets a fresh name, so a replaced
// image is never served from a stale cache.
const PREFIX = 'announcements/'

function bucket(): string {
  return process.env.SUPABASE_COURSE_IMAGES_BUCKET!
}

// Returns null for anything that is not an announcement object in our bucket,
// so a malformed URL can never delete a course image.
export function storagePathFromPublicUrl(publicUrl: string): string | null {
  let pathname: string
  try {
    pathname = new URL(publicUrl).pathname
  } catch {
    return null
  }
  // Anchored at the start, so a host that merely contains the marker further
  // along its path cannot be mistaken for a real Supabase object URL.
  const marker = `/storage/v1/object/public/${bucket()}/`
  if (!pathname.startsWith(marker)) return null
  const path = decodeURIComponent(pathname.slice(marker.length))
  if (!path.startsWith(PREFIX)) return null
  // Decoding can reveal a `..` segment (e.g. an encoded slash) that the URL
  // parser's own normalization never saw, so it must be checked afterward.
  if (path.split('/').includes('..')) return null
  return path
}

export async function uploadAnnouncementImage(image: {
  buffer: Buffer
  ext: string
  contentType: string
}): Promise<string> {
  const path = `${PREFIX}${randomUUID()}.${image.ext}`
  const { error } = await supabaseAdmin.storage
    .from(bucket())
    .upload(path, image.buffer, { contentType: image.contentType, upsert: false })
  if (error) throw error
  return supabaseAdmin.storage.from(bucket()).getPublicUrl(path).data.publicUrl
}

// Best effort: an orphaned file is harmless, so a failed removal is logged
// and never fails the save or delete that triggered it.
export async function removeAnnouncementImage(publicUrl: string): Promise<void> {
  const path = storagePathFromPublicUrl(publicUrl)
  if (!path) {
    console.error('[removeAnnouncementImage] not an announcement image', publicUrl)
    return
  }
  try {
    const { error } = await supabaseAdmin.storage.from(bucket()).remove([path])
    if (error) console.error('[removeAnnouncementImage]', error)
  } catch (err) {
    console.error('[removeAnnouncementImage]', err)
  }
}
