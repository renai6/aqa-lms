import { describe, it, expect } from 'vitest'
import { pageHref, pageRange } from '@/lib/pagination'

describe('pageHref', () => {
  it('carries the active filters onto the target page', () => {
    const href = pageHref('/admin/students', { course: 'c1', gender: 'MALE' }, 2)

    expect(href).toBe('/admin/students?course=c1&gender=MALE&page=2')
  })

  // Page 1 is the same view as no page at all; keeping one canonical URL means
  // "clear filters" and a fresh visit never disagree.
  it('omits the page parameter on the first page', () => {
    expect(pageHref('/admin/students', { course: 'c1' }, 1)).toBe(
      '/admin/students?course=c1',
    )
  })

  it('returns a bare path when there is nothing to carry', () => {
    expect(pageHref('/admin/students', {}, 1)).toBe('/admin/students')
  })

  it('drops filters that are unset or empty', () => {
    const href = pageHref(
      '/admin/students',
      { course: undefined, gender: '' },
      3,
    )

    expect(href).toBe('/admin/students?page=3')
  })

  it('encodes filter values', () => {
    expect(pageHref('/admin/students', { course: 'a b&c' }, 1)).toBe(
      '/admin/students?course=a+b%26c',
    )
  })
})

describe('pageRange', () => {
  it('describes the first page as starting at one', () => {
    expect(pageRange(1, 50, 743)).toEqual({ from: 1, to: 50 })
  })

  it('offsets a middle page past the pages before it', () => {
    expect(pageRange(3, 50, 743)).toEqual({ from: 101, to: 150 })
  })

  // The last page is usually partial; `to` must be the total, not the page
  // boundary, or the table claims rows it did not render.
  it('stops a partial last page at the total', () => {
    expect(pageRange(3, 50, 120)).toEqual({ from: 101, to: 120 })
  })

  it('collapses to zero when nothing matches', () => {
    expect(pageRange(1, 50, 0)).toEqual({ from: 0, to: 0 })
  })
})
