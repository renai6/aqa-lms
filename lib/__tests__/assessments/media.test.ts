import { describe, it, expect } from 'vitest'
import { extractDriveFileId, driveEmbedUrl } from '@/lib/assessments/media'

describe('extractDriveFileId', () => {
  it('extracts the id from a /file/d/<id>/view share link', () => {
    expect(
      extractDriveFileId(
        'https://drive.google.com/file/d/1AbC-dEf_23/view?usp=sharing',
      ),
    ).toBe('1AbC-dEf_23')
  })

  it('extracts the id from a /file/d/<id>/preview link', () => {
    expect(
      extractDriveFileId('https://drive.google.com/file/d/1AbC-dEf_23/preview'),
    ).toBe('1AbC-dEf_23')
  })

  it('extracts the id from an open?id= link', () => {
    expect(
      extractDriveFileId('https://drive.google.com/open?id=1AbC-dEf_23'),
    ).toBe('1AbC-dEf_23')
  })

  it('extracts the id from a uc?export=download&id= link', () => {
    expect(
      extractDriveFileId(
        'https://drive.google.com/uc?export=download&id=1AbC-dEf_23',
      ),
    ).toBe('1AbC-dEf_23')
  })

  it('accepts a link on the docs.google.com host', () => {
    expect(
      extractDriveFileId('https://docs.google.com/file/d/1AbC-dEf_23/view'),
    ).toBe('1AbC-dEf_23')
  })

  it('ignores surrounding whitespace', () => {
    expect(
      extractDriveFileId('  https://drive.google.com/file/d/1AbC-dEf_23/view '),
    ).toBe('1AbC-dEf_23')
  })

  it('rejects a non-Drive host that mentions drive.google.com in its path', () => {
    expect(
      extractDriveFileId('https://evil.test/drive.google.com/file/d/1AbC/view'),
    ).toBeNull()
  })

  it('rejects a Drive folder link, which has no playable file', () => {
    expect(
      extractDriveFileId('https://drive.google.com/drive/folders/1AbC-dEf_23'),
    ).toBeNull()
  })

  it('rejects a non-Drive url', () => {
    expect(extractDriveFileId('https://example.com/audio.mp3')).toBeNull()
  })

  it('rejects an http (non-https) drive link', () => {
    expect(
      extractDriveFileId('http://drive.google.com/file/d/1AbC-dEf_23/view'),
    ).toBeNull()
  })

  it('rejects a malformed url', () => {
    expect(extractDriveFileId('not a url')).toBeNull()
  })

  it('rejects an empty string', () => {
    expect(extractDriveFileId('')).toBeNull()
  })
})

describe('driveEmbedUrl', () => {
  it('builds the preview embed url for a file id', () => {
    expect(driveEmbedUrl('1AbC-dEf_23')).toBe(
      'https://drive.google.com/file/d/1AbC-dEf_23/preview',
    )
  })
})
