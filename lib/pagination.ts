// lib/pagination.ts

// Builds the href for one page of a filtered list view, carrying the active
// filters along so paging never silently widens the result set. Page 1 drops
// the parameter, keeping the unpaginated URL as the canonical one.
export function pageHref(
  basePath: string,
  filters: Record<string, string | undefined>,
  page: number,
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }
  if (page > 1) params.set('page', String(page))

  return basePath + (params.size ? '?' + params.toString() : '')
}

// The 1-based row span shown on a page, for a "Showing 101-150 of 743" label.
// `to` is capped at the total so a partial last page never claims rows that
// were not rendered.
export function pageRange(
  page: number,
  pageSize: number,
  total: number,
): { from: number; to: number } {
  if (total === 0) return { from: 0, to: 0 }

  return {
    from: (page - 1) * pageSize + 1,
    to: Math.min(page * pageSize, total),
  }
}
