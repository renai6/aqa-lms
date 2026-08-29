import { describe, it, expect } from 'vitest'
import { parseMedia } from '@/lib/assessments/media'

const VALID = 'https://drive.google.com/file/d/1AbC-dEf_23/view?usp=sharing'

function form(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('parseMedia', () => {
  it('returns nulls when the form carries no media fields at all', () => {
    expect(parseMedia(form({}))).toEqual({ mediaType: null, mediaUrl: null })
  })

  it('returns nulls when the admin picked NONE', () => {
    expect(parseMedia(form({ mediaType: 'NONE' }))).toEqual({
      mediaType: null,
      mediaUrl: null,
    })
  })

  it('clears a previously set url when the admin switches back to NONE', () => {
    expect(parseMedia(form({ mediaType: 'NONE', mediaUrl: VALID }))).toEqual({
      mediaType: null,
      mediaUrl: null,
    })
  })

  it('accepts an audio link and keeps the url the admin pasted', () => {
    expect(parseMedia(form({ mediaType: 'AUDIO', mediaUrl: VALID }))).toEqual({
      mediaType: 'AUDIO',
      mediaUrl: VALID,
    })
  })

  it('accepts an image link', () => {
    expect(parseMedia(form({ mediaType: 'IMAGE', mediaUrl: VALID }))).toEqual({
      mediaType: 'IMAGE',
      mediaUrl: VALID,
    })
  })

  it('trims whitespace around the stored url', () => {
    expect(
      parseMedia(form({ mediaType: 'AUDIO', mediaUrl: '  ' + VALID + ' ' })),
    ).toEqual({
      mediaType: 'AUDIO',
      mediaUrl: VALID,
    })
  })

  it('rejects a media type with a missing url', () => {
    expect(parseMedia(form({ mediaType: 'AUDIO' }))).toMatch(/Google Drive/)
  })

  it('rejects a media type with a blank url', () => {
    expect(parseMedia(form({ mediaType: 'AUDIO', mediaUrl: '   ' }))).toMatch(
      /Google Drive/,
    )
  })

  it('rejects a url that is not a Google Drive file link', () => {
    expect(
      parseMedia(
        form({ mediaType: 'AUDIO', mediaUrl: 'https://example.com/a.mp3' }),
      ),
    ).toMatch(/Google Drive/)
  })

  it('rejects an unrecognised media type', () => {
    expect(parseMedia(form({ mediaType: 'VIDEO', mediaUrl: VALID }))).toMatch(
      /media type/i,
    )
  })
})
