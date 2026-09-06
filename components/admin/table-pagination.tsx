// components/admin/table-pagination.tsx
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pageRange } from '@/lib/pagination'

type Props = {
  page: number
  pageCount: number
  total: number
  pageSize: number
  // Given a page number, the URL that shows it. Owned by the calling page so
  // its own filters travel with the link.
  hrefFor: (page: number) => string
  // Plural noun for the rows, e.g. "students".
  noun: string
}

// Prev/next paging rendered as plain links, so pages stay shareable, the back
// button works, and the table needs no client JavaScript.
export function TablePagination({
  page,
  pageCount,
  total,
  pageSize,
  hrefFor,
  noun,
}: Props) {
  if (total === 0) return null

  const { from, to } = pageRange(page, pageSize, total)

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4 flex-wrap"
    >
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> of{' '}
        <span className="font-medium text-foreground">{total}</span> {noun}
      </p>

      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <PageLink href={hrefFor(page - 1)} disabled={page <= 1} rel="prev">
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Previous
          </PageLink>

          <span className="text-sm text-muted-foreground tabular-nums">
            Page {page} of {pageCount}
          </span>

          <PageLink href={hrefFor(page + 1)} disabled={page >= pageCount} rel="next">
            Next
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </PageLink>
        </div>
      )}
    </nav>
  )
}

// A disabled step renders as a real disabled button rather than a dead link, so
// it is skipped by keyboard and announced as unavailable.
function PageLink({
  href,
  disabled,
  rel,
  children,
}: {
  href: string
  disabled: boolean
  rel: 'prev' | 'next'
  children: React.ReactNode
}) {
  if (disabled) {
    return (
      <Button variant="outline" size="sm" disabled>
        {children}
      </Button>
    )
  }

  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={href} rel={rel}>
        {children}
      </Link>
    </Button>
  )
}
