import { describe, it, expect } from 'vitest'
import { parseDriveFolderId, toPreviewUrl } from '@/lib/batches/drive'

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

describe('parseDriveFolderId', () => {
  it('reads the id from a folder share link', () => {
    expect(
      parseDriveFolderId('https://drive.google.com/drive/folders/1AbC_d-E?usp=sharing'),
    ).toBe('1AbC_d-E')
  })

  it('reads the id from a signed-in account link', () => {
    expect(parseDriveFolderId('https://drive.google.com/drive/u/1/folders/XYZ')).toBe('XYZ')
  })

  it('reads the id from the older open?id= shape', () => {
    expect(parseDriveFolderId('https://drive.google.com/open?id=XYZ')).toBe('XYZ')
  })

  it('tolerates surrounding whitespace', () => {
    expect(parseDriveFolderId('  https://drive.google.com/drive/folders/XYZ  ')).toBe('XYZ')
  })

  it('rejects a file link, since a file is not a folder', () => {
    expect(parseDriveFolderId('https://drive.google.com/file/d/ABC/view')).toBeNull()
  })

  it('rejects a folder path on another host', () => {
    expect(parseDriveFolderId('https://example.com/drive/folders/XYZ')).toBeNull()
  })

  it('rejects text that is not a url', () => {
    expect(parseDriveFolderId('XYZ')).toBeNull()
  })
})
