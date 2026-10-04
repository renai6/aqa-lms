import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { listFolderRecordings } from '@/lib/batches/drive-folder'

const FOLDER = { mimeType: 'application/vnd.google-apps.folder' }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('listFolderRecordings', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubEnv('GOOGLE_API_KEY', 'test-key')
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("lists the folder's videos newest first, titled by file name", async () => {
    fetchMock
      .mockResolvedValueOnce(json(FOLDER))
      .mockResolvedValueOnce(
        json({ files: [{ id: 'v2', name: 'Week 2 - Tajweed.mp4' }, { id: 'v1', name: 'Week 1' }] }),
      )

    expect(await listFolderRecordings('F1')).toEqual({
      ok: true,
      recordings: [
        { id: 'v2', title: 'Week 2 - Tajweed', url: 'https://drive.google.com/file/d/v2/view' },
        { id: 'v1', title: 'Week 1', url: 'https://drive.google.com/file/d/v1/view' },
      ],
    })

    const listUrl = new URL(String(fetchMock.mock.calls[1][0]))
    expect(listUrl.searchParams.get('q')).toBe(
      "'F1' in parents and trashed = false and mimeType contains 'video/'",
    )
    expect(listUrl.searchParams.get('orderBy')).toBe('createdTime desc')
    expect(listUrl.searchParams.get('key')).toBe('test-key')
  })

  it('follows pagination to the last page', async () => {
    fetchMock
      .mockResolvedValueOnce(json(FOLDER))
      .mockResolvedValueOnce(json({ files: [{ id: 'a', name: 'a.mp4' }], nextPageToken: 'p2' }))
      .mockResolvedValueOnce(json({ files: [{ id: 'b', name: 'b.mp4' }] }))

    const result = await listFolderRecordings('F1')

    expect(result.ok && result.recordings.map((r) => r.id)).toEqual(['a', 'b'])
    expect(new URL(String(fetchMock.mock.calls[2][0])).searchParams.get('pageToken')).toBe('p2')
  })

  // Listing the children of a folder the key cannot see comes back empty, not
  // as an error - the folder lookup is what tells the two apart.
  it('reports a folder Drive will not show as not-found', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: {} }, 404))

    expect(await listFolderRecordings('F1')).toEqual({ ok: false, reason: 'not-found' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports a file id passed as a folder as not-found', async () => {
    fetchMock.mockResolvedValueOnce(json({ mimeType: 'video/mp4' }))

    expect(await listFolderRecordings('F1')).toEqual({ ok: false, reason: 'not-found' })
  })

  it('reports a Drive error as unavailable', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: {} }, 403))

    expect(await listFolderRecordings('F1')).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('reports a network failure as unavailable', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))

    expect(await listFolderRecordings('F1')).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('is unavailable without an API key, and never calls Drive', async () => {
    vi.stubEnv('GOOGLE_API_KEY', '')

    expect(await listFolderRecordings('F1')).toEqual({ ok: false, reason: 'unavailable' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects an id that could break out of the query string', async () => {
    expect(await listFolderRecordings("F1' or '1'='1")).toEqual({ ok: false, reason: 'not-found' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
