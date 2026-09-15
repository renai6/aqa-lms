import { describe, it, expect } from 'vitest'
import { parseAnnouncementForm } from '@/lib/announcements/validation'

function form(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData()
  const base = { title: 'Eid break', content: 'Classes resume Monday.', audience: 'EVERYONE', intent: 'save' }
  for (const [key, value] of Object.entries({ ...base, ...fields })) {
    if (Array.isArray(value)) value.forEach((v) => fd.append(key, v))
    else fd.set(key, value)
  }
  return fd
}

function errorOf(fd: FormData): string | undefined {
  const result = parseAnnouncementForm(fd)
  return result.ok ? undefined : result.error
}

describe('parseAnnouncementForm', () => {
  it('parses a minimal everyone announcement', () => {
    const result = parseAnnouncementForm(form({ title: '  Eid break  ', content: ' Resume Monday. ' }))
    expect(result).toEqual({
      ok: true,
      data: {
        id: undefined,
        title: 'Eid break',
        content: 'Resume Monday.',
        audience: 'EVERYONE',
        courseIds: [],
        isPinned: false,
        removeImage: false,
        intent: 'save',
      },
    })
  })

  it('reads the id and checkboxes', () => {
    const result = parseAnnouncementForm(form({ id: 'a1', isPinned: 'on', removeImage: 'on' }))
    expect(result.ok && result.data).toMatchObject({ id: 'a1', isPinned: true, removeImage: true })
  })

  it('requires a title', () => {
    expect(errorOf(form({ title: '   ' }))).toBe('Title is required.')
  })

  it('caps the title at 200 characters', () => {
    expect(errorOf(form({ title: 'a'.repeat(200) }))).toBeUndefined()
    expect(errorOf(form({ title: 'a'.repeat(201) }))).toBe('Title must be 200 characters or fewer.')
  })

  it('requires content', () => {
    expect(errorOf(form({ content: '' }))).toBe('Content is required.')
  })

  it('caps content at 5,000 characters', () => {
    expect(errorOf(form({ content: 'a'.repeat(5001) }))).toBe('Content must be 5,000 characters or fewer.')
  })

  it('requires an audience', () => {
    const fd = form({})
    fd.delete('audience')
    expect(errorOf(fd)).toBe('Please choose an audience.')
  })

  it('requires at least one course for a course audience', () => {
    expect(errorOf(form({ audience: 'COURSES' }))).toBe('Choose at least one course.')
  })

  it('collects every course id once', () => {
    const result = parseAnnouncementForm(form({ audience: 'COURSES', courseIds: ['c1', 'c2', 'c1'] }))
    expect(result.ok && result.data.courseIds).toEqual(['c1', 'c2'])
  })

  it('rejects an unknown intent', () => {
    expect(errorOf(form({ intent: 'archive' }))).toBe('Invalid action.')
  })
})
