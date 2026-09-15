import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const storage = vi.hoisted(() => ({
  from: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  getPublicUrl: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { storage: { from: storage.from } },
}))

import {
  storagePathFromPublicUrl,
  uploadAnnouncementImage,
  removeAnnouncementImage,
} from '@/lib/announcements/storage'

const BASE = 'https://abc.supabase.co/storage/v1/object/public'

describe('announcement storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('SUPABASE_COURSE_IMAGES_BUCKET', 'course-images')
    storage.from.mockReturnValue({
      upload: storage.upload,
      remove: storage.remove,
      getPublicUrl: storage.getPublicUrl,
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => vi.unstubAllEnvs())

  describe('storagePathFromPublicUrl', () => {
    it('maps a public bucket URL to its object path', () => {
      expect(storagePathFromPublicUrl(`${BASE}/course-images/announcements/abc.png`)).toBe(
        'announcements/abc.png',
      )
    })

    it('decodes a percent-encoded path segment', () => {
      expect(storagePathFromPublicUrl(`${BASE}/course-images/announcements/a%20b.png`)).toBe(
        'announcements/a b.png',
      )
    })

    // Guards the shared bucket: a bad URL must never resolve to a course image.
    it('refuses paths outside announcements/', () => {
      expect(storagePathFromPublicUrl(`${BASE}/course-images/courses/c1/image.png`)).toBeNull()
    })

    it('refuses another bucket and non-URLs', () => {
      expect(storagePathFromPublicUrl(`${BASE}/proofs/announcements/abc.png`)).toBeNull()
      expect(storagePathFromPublicUrl('not a url')).toBeNull()
    })

    it('refuses a path traversal segment revealed only after decoding', () => {
      // The slash is percent-encoded so the URL parser keeps `..%2Fcourses` as
      // one opaque segment and never runs its own dot-segment normalization;
      // only our decodeURIComponent turns it into a real `..` segment.
      expect(
        storagePathFromPublicUrl(`${BASE}/course-images/announcements/..%2Fcourses/c1/image.png`),
      ).toBeNull()
    })

    it('refuses a URL whose marker is not at the start of the pathname', () => {
      expect(
        storagePathFromPublicUrl(
          'https://evil.example/not/storage/v1/object/public/course-images/announcements/abc.png',
        ),
      ).toBeNull()
    })
  })

  describe('uploadAnnouncementImage', () => {
    it('stores under a fresh announcements/ name and returns the public URL', async () => {
      storage.upload.mockResolvedValue({ error: null })
      storage.getPublicUrl.mockImplementation((path: string) => ({
        data: { publicUrl: `${BASE}/course-images/${path}` },
      }))

      const url = await uploadAnnouncementImage({
        buffer: Buffer.from([1]),
        ext: 'png',
        contentType: 'image/png',
      })

      expect(storage.from).toHaveBeenCalledWith('course-images')
      const [path, , options] = storage.upload.mock.calls[0]
      expect(path).toMatch(/^announcements\/[0-9a-f-]{36}\.png$/)
      expect(options).toEqual({ contentType: 'image/png', upsert: false })
      expect(url).toBe(`${BASE}/course-images/${path}`)
    })

    it('throws when the upload fails', async () => {
      storage.upload.mockResolvedValue({ error: new Error('boom') })
      await expect(
        uploadAnnouncementImage({ buffer: Buffer.from([1]), ext: 'png', contentType: 'image/png' }),
      ).rejects.toThrow('boom')
    })
  })

  describe('removeAnnouncementImage', () => {
    it('removes the object behind the URL', async () => {
      storage.remove.mockResolvedValue({ error: null })
      await removeAnnouncementImage(`${BASE}/course-images/announcements/abc.png`)
      expect(storage.remove).toHaveBeenCalledWith(['announcements/abc.png'])
    })

    it('logs and resolves when Supabase reports an error', async () => {
      storage.remove.mockResolvedValue({ error: new Error('nope') })
      await expect(
        removeAnnouncementImage(`${BASE}/course-images/announcements/abc.png`),
      ).resolves.toBeUndefined()
      expect(console.error).toHaveBeenCalled()
    })

    it('logs and resolves when the call throws', async () => {
      storage.remove.mockRejectedValue(new Error('network'))
      await expect(
        removeAnnouncementImage(`${BASE}/course-images/announcements/abc.png`),
      ).resolves.toBeUndefined()
      expect(console.error).toHaveBeenCalled()
    })

    it('does nothing for a URL outside announcements/', async () => {
      await removeAnnouncementImage(`${BASE}/course-images/courses/c1/image.png`)
      expect(storage.remove).not.toHaveBeenCalled()
    })
  })
})
