import { describe, it, expect } from 'vitest'
import { MAX_SIZE, validateImageUpload } from '@/lib/uploads/image'

function fileFrom(bytes: number[], type: string, name = 'proof') {
  return new File([new Uint8Array(bytes)], name, { type })
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]
const JPEG = [0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]

describe('validateImageUpload', () => {
  it('accepts a valid PNG and returns buffer + ext', async () => {
    const res = await validateImageUpload(fileFrom(PNG, 'image/png'))
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.ext).toBe('png')
  })

  it('accepts JPEG and WEBP', async () => {
    expect((await validateImageUpload(fileFrom(JPEG, 'image/jpeg'))).ok).toBe(true)
    expect((await validateImageUpload(fileFrom(WEBP, 'image/webp'))).ok).toBe(true)
  })

  it('rejects an empty file', async () => {
    const res = await validateImageUpload(fileFrom([], 'image/png'))
    expect(res.ok).toBe(false)
  })

  it('rejects a disallowed mime type', async () => {
    const res = await validateImageUpload(fileFrom(PNG, 'application/pdf'))
    expect(res.ok).toBe(false)
  })

  it('rejects content whose magic bytes do not match an image', async () => {
    const res = await validateImageUpload(fileFrom([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'image/png'))
    expect(res.ok).toBe(false)
  })

  it('rejects files larger than MAX_SIZE', async () => {
    const big = new File([new Uint8Array(MAX_SIZE + 1)], 'big', { type: 'image/png' })
    const res = await validateImageUpload(big)
    expect(res.ok).toBe(false)
  })

  it('accepts an image at exactly MAX_SIZE', async () => {
    const bytes = new Uint8Array(MAX_SIZE)
    bytes.set(PNG)
    const res = await validateImageUpload(new File([bytes], 'max', { type: 'image/png' }))
    expect(res.ok).toBe(true)
  })
})
