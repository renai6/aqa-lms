import { describe, it, expect } from 'vitest'
import { toPreviewUrl } from '@/lib/batches/drive'

describe('toPreviewUrl', () => {
  it('converts a Drive view link to a preview link', () => {
    expect(toPreviewUrl('https://drive.google.com/file/d/ABC123/view?usp=sharing')).toBe(
      'https://drive.google.com/file/d/ABC123/preview',
    )
  })

  it('converts a link that is already a preview link', () => {
    expect(toPreviewUrl('https://drive.google.com/file/d/ABC123/preview')).toBe(
      'https://drive.google.com/file/d/ABC123/preview',
    )
  })

  it('returns null for a Drive link with no file id segment', () => {
    expect(toPreviewUrl('https://drive.google.com/drive/folders/XYZ')).toBeNull()
  })

  it('returns null for a non-Drive url', () => {
    expect(toPreviewUrl('https://example.com/video.mp4')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(toPreviewUrl('')).toBeNull()
  })
})
