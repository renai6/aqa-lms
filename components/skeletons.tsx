// components/skeletons.tsx
//
// Building blocks for route-level loading.tsx files. Each one mirrors the real
// markup it stands in for -- same container, same padding, same column count --
// so the swap from placeholder to content does not shift the layout.
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

type LoadingScreenProps = {
  className?: string
  children: React.ReactNode
}

// Wraps a route's loading UI. The whole screen is one busy region, so assistive
// tech announces "Loading" once rather than once per placeholder.
export function LoadingScreen({ className, children }: LoadingScreenProps) {
  return (
    <div role="status" aria-busy="true" className={cn('p-6 space-y-6', className)}>
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  )
}

// Mirrors <PageHeader>: same flex row and the same mb-6 the real header owns.
export function PageHeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <Skeleton className="h-7 w-44" />
      {withAction && <Skeleton className="h-9 w-32 shrink-0" />}
    </div>
  )
}

// The tab strips and filter rows that sit above most admin list tables.
export function ToolbarSkeleton({ items = 3 }: { items?: number }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: items }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-28" />
      ))}
    </div>
  )
}

// Cycled rather than randomised: a loading.tsx renders on the server and again
// on the client, and random widths would not match across the two.
const CELL_WIDTHS = ['w-32', 'w-40', 'w-16', 'w-28', 'w-20', 'w-24']

type TableSkeletonProps = {
  columns?: number
  rows?: number
  // Admin and teacher tables end in a narrow, right-aligned actions cell rather
  // than another text column, so the last column is drawn to match.
  actionsColumn?: boolean
}

export function TableSkeleton({
  columns = 6,
  rows = 8,
  actionsColumn = true,
}: TableSkeletonProps) {
  const lastIndex = columns - 1
  const isActions = (i: number) => actionsColumn && i === lastIndex

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} scope="col" className="text-left px-4 py-3">
                {/* Darker than the body bars so they stay legible on bg-muted. */}
                {!isActions(i) && <Skeleton className="h-3 w-20 bg-muted-foreground/25" />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }).map((_, c) => (
                <td key={c} className="px-4 py-3">
                  <Skeleton
                    className={cn(
                      'h-4',
                      isActions(c) ? 'w-6 ml-auto' : CELL_WIDTHS[c % CELL_WIDTHS.length],
                    )}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type StatCardsProps = {
  count?: number
  // 'stacked' matches the admin dashboard (icon above the number), 'row' the
  // teacher dashboard (icon beside it).
  orientation?: 'stacked' | 'row'
  className?: string
}

export function StatCardsSkeleton({
  count = 4,
  orientation = 'stacked',
  className,
}: StatCardsProps) {
  return (
    <div className={cn('grid gap-4', className)}>
      {Array.from({ length: count }).map((_, i) =>
        orientation === 'stacked' ? (
          <div key={i} className="p-4 border rounded-lg bg-card space-y-3">
            <Skeleton className="w-8 h-8 rounded-md" />
            <div className="space-y-1.5">
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ) : (
          <div key={i} className="border border-border bg-card rounded-lg shadow-sm">
            <div className="flex items-center gap-4 p-6">
              <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
          </div>
        ),
      )}
    </div>
  )
}
