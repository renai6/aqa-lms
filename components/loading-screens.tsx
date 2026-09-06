// components/loading-screens.tsx
//
// The composed loading UI behind every route's loading.tsx. They live here
// rather than in the route files because a loading.tsx has to sit in the
// segment that actually changes on navigation -- React keeps an already-mounted
// Suspense boundary showing its old content instead of reverting to a fallback,
// so a single boundary high in the tree never fires when moving between sibling
// pages. That means many small files, each of which re-exports one of these.
import {
  LoadingScreen,
  PageHeaderSkeleton,
  ToolbarSkeleton,
  TableSkeleton,
  StatCardsSkeleton,
} from '@/components/skeletons'
import { Skeleton } from '@/components/ui/skeleton'

// Filtered list tables: students, users, courses, purchases, payments.
export function AdminListLoading() {
  return (
    <LoadingScreen>
      <PageHeaderSkeleton withAction />
      <ToolbarSkeleton />
      <TableSkeleton columns={7} rows={8} />
    </LoadingScreen>
  )
}

// Stat cards over a short pending-purchases table.
export function AdminDashboardLoading() {
  return (
    <LoadingScreen>
      <PageHeaderSkeleton />
      <Skeleton className="h-5 w-64 -mt-4" />
      <StatCardsSkeleton count={4} className="grid-cols-2 lg:grid-cols-4" />
      <div>
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-4 w-16" />
        </div>
        <TableSkeleton columns={4} rows={5} />
      </div>
    </LoadingScreen>
  )
}

// A record beside its summary panel: students/[id], courses/[id].
export function AdminSplitDetailLoading() {
  return (
    <LoadingScreen>
      <PageHeaderSkeleton withAction />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <Skeleton className="h-4 w-32" />
          <TableSkeleton columns={5} rows={4} />
        </div>
        <div className="border rounded-lg p-4 space-y-3 self-start">
          <Skeleton className="h-4 w-28" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-36" />
            </div>
          ))}
        </div>
      </div>
    </LoadingScreen>
  )
}

// Stacked review cards on a narrow column: purchases/[id], payments/[id].
export function AdminStackedDetailLoading() {
  return (
    <LoadingScreen className="max-w-3xl space-y-6 p-6">
      <PageHeaderSkeleton />
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-card rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      ))}
    </LoadingScreen>
  )
}

// Subject and roster tables.
export function TeacherListLoading() {
  return (
    <LoadingScreen>
      <PageHeaderSkeleton />
      <TableSkeleton columns={5} rows={6} actionsColumn={false} />
    </LoadingScreen>
  )
}

export function TeacherDashboardLoading() {
  return (
    <LoadingScreen>
      <PageHeaderSkeleton />
      <StatCardsSkeleton
        count={2}
        orientation="row"
        className="max-w-2xl grid-cols-1 sm:grid-cols-2"
      />
    </LoadingScreen>
  )
}

// Student pages are stacked card sections on the layout's wider gutter, not
// tables under a page header.
export function StudentLoading() {
  return (
    <LoadingScreen className="space-y-8 px-6 py-10 md:px-10">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-9 w-32 shrink-0" />
      </div>

      <section className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </section>
    </LoadingScreen>
  )
}
