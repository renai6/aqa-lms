# Admin UI Redesign — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the admin shell and dashboard into a dense, data-forward interface with a dark zinc sidebar, crimson accents, compact tables, a shared PageHeader component, and a live dashboard with enrollment stats.

**Architecture:** The sidebar activates its dark theme by receiving `class="dark"` — no new design tokens needed, the existing CSS vars handle it. A new `<PageHeader>` server component standardises breadcrumbs + h1 + action slot across all pages. Dashboard data comes from three parallel Prisma queries inlined in the page. Table rows are made more compact by replacing `py-3` with `py-2` and text links with ghost buttons.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Prisma 7 (`db` from `@/lib/db`), Lucide React

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `components/admin/page-header.tsx` | **Create** | Shared breadcrumb + h1 + action slot used at the top of every page |
| `components/admin/top-bar.tsx` | **Create** | Sticky `h-12` chrome bar at the top of `<main>` (Phase 1: empty right slot) |
| `app/(admin)/layout.tsx` | **Modify** | Dark sidebar, AQA logo mark, user role chip, integrate TopBar |
| `app/(admin)/nav-link.tsx` | **Modify** | Tighter padding, crimson left-border active state, Coming Soon tooltip |
| `app/(admin)/admin/dashboard/page.tsx` | **Rewrite** | Stat cards, quick stats line, recent pending requests table |
| `app/(admin)/admin/enrollments/page.tsx` | **Modify** | All-tab counts via groupBy, `py-2` rows, ghost buttons, PageHeader, icon empty state |
| `app/(admin)/admin/courses/page.tsx` | **Modify** | `py-2` rows, ghost buttons, PageHeader, icon empty state |
| `app/(admin)/admin/users/page.tsx` | **Modify** | Fix layout to `p-6 max-w-5xl`, add PageHeader |
| `app/(admin)/admin/courses/[id]/page.tsx` | **Modify** | Replace ad-hoc header with PageHeader + breadcrumb |
| `app/(admin)/admin/enrollments/[id]/page.tsx` | **Modify** | Replace ad-hoc header with PageHeader + breadcrumb |
| `app/(admin)/admin/courses/[id]/subjects/[sid]/page.tsx` | **Modify** | Replace ad-hoc header with PageHeader + breadcrumb |

---

## Task 1: Create `<PageHeader>` component

**Files:**
- Create: `components/admin/page-header.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/admin/page-header.tsx
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

type Breadcrumb = {
  label: string
  href?: string
}

type Props = {
  breadcrumbs?: Breadcrumb[]
  title: string
  action?: React.ReactNode
}

export function PageHeader({ breadcrumbs, title, action }: Props) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 mb-1">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Lint check**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/page-header.tsx
git commit -m "feat(admin): add shared PageHeader component with breadcrumbs and action slot"
```

---

## Task 2: Create `<TopBar>` component

**Files:**
- Create: `components/admin/top-bar.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/admin/top-bar.tsx
export function TopBar() {
  return (
    <header className="h-12 bg-background border-b border-border sticky top-0 z-10 px-6 flex items-center justify-between shrink-0">
      {/* Left slot: reserved for breadcrumb context in future phases */}
      <div />
      {/* Right slot: reserved for global search / notifications */}
      <div />
    </header>
  )
}
```

- [ ] **Step 2: Lint check**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/top-bar.tsx
git commit -m "feat(admin): add TopBar chrome component for main content area"
```

---

## Task 3: Redesign the sidebar and layout shell

**Files:**
- Modify: `app/(admin)/layout.tsx`

The sidebar goes dark by adding `class="dark"` to `<aside>`. This activates the existing dark CSS vars (`--sidebar: oklch(0.205 0 0)`, `--sidebar-primary: oklch(0.656 0.241 354.308)`). No new tokens needed.

The logo area is replaced with the AQA logo mark (matching the public `Navbar`). A user role chip is added above logout. The `<TopBar>` is added inside `<main>`.

Session has shape `{ userId: string; role: UserRole }` — use `role` for the chip label.

- [ ] **Step 1: Rewrite the layout**

```tsx
// app/(admin)/layout.tsx
import type { Metadata } from 'next'
import {
  LayoutDashboard,
  Users,
  BookOpen,
  BarChart2,
  LogOut,
  UserCog,
  ShieldCheck,
} from 'lucide-react'
import { NavLink } from './nav-link'
import { TopBar } from '@/components/admin/top-bar'
import { getSession } from '@/lib/auth/session'

export const metadata: Metadata = {
  title: "Admin — Al-Qur'an Academy",
}

function roleLabel(role: string) {
  switch (role) {
    case 'SUPER_ADMIN': return 'Super Admin'
    case 'ADMIN': return 'Admin'
    default: return role
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  return (
    <div className="flex h-dvh bg-background">
      {/* Sidebar — dark class activates dark sidebar CSS vars */}
      <aside className="w-64 border-r border-sidebar-border flex flex-col bg-sidebar dark shrink-0">
        {/* Logo / brand area */}
        <div className="px-5 py-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full border-2 border-primary flex items-center justify-center shrink-0">
              <span className="text-primary font-bold text-[10px] tracking-tight">AQA</span>
            </div>
            <div className="leading-none">
              <p className="text-sidebar-foreground text-[11px] font-semibold tracking-wide">
                AL-QUR&apos;AN ACADEMY
              </p>
              <p className="text-sidebar-foreground/50 text-[9px] tracking-widest mt-0.5">
                INTERNATIONAL
              </p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav aria-label="Admin navigation" className="flex-1 flex flex-col gap-0.5 p-3">
          <NavLink
            href="/admin/dashboard"
            icon={<LayoutDashboard className="w-4 h-4" aria-hidden="true" />}
            label="Dashboard"
          />
          <NavLink
            href="/admin/enrollments"
            icon={<Users className="w-4 h-4" aria-hidden="true" />}
            label="Enrollments"
          />
          <NavLink
            href="/admin/users"
            icon={<UserCog className="w-4 h-4" aria-hidden="true" />}
            label="Users"
          />
          <NavLink
            href="/admin/courses"
            icon={<BookOpen className="w-4 h-4" aria-hidden="true" />}
            label="Courses"
          />
          <NavLink
            href="/admin/reports"
            icon={<BarChart2 className="w-4 h-4" aria-hidden="true" />}
            label="Reports"
            disabled
          />
        </nav>

        {/* Bottom: user chip + logout */}
        <div className="border-t border-sidebar-border p-3 space-y-1">
          {session && (
            <div className="flex items-center gap-2.5 px-3 py-2">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 text-primary-foreground" aria-hidden="true" />
              </div>
              <div className="leading-none min-w-0">
                <p className="text-sidebar-foreground text-xs font-medium truncate">
                  {roleLabel(session.role)}
                </p>
                <p className="text-sidebar-foreground/50 text-[10px] mt-0.5 truncate">
                  {session.userId.slice(0, 8)}…
                </p>
              </div>
            </div>
          )}
          <a
            href="/api/auth/logout"
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Logout</span>
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        <TopBar />
        <div className="flex-1">
          {children}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Lint check**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/layout.tsx
git commit -m "feat(admin): dark sidebar with AQA logo mark, user role chip, and TopBar"
```

---

## Task 4: Redesign `NavLink` component

**Files:**
- Modify: `app/(admin)/nav-link.tsx`

Changes: tighter padding (`px-3 py-2`), crimson left-border active state (`border-l-2 border-primary`), smaller icons (`w-4 h-4` already done in layout — NavLink just receives whatever icon), disabled items get `title="Coming soon"`.

- [ ] **Step 1: Rewrite nav-link.tsx**

```tsx
// app/(admin)/nav-link.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type NavLinkProps = {
  href: string
  icon: React.ReactNode
  label: string
  disabled?: boolean
}

export function NavLink({ href, icon, label, disabled }: NavLinkProps) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')

  const base = 'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors'

  if (disabled) {
    return (
      <span
        role="link"
        aria-disabled="true"
        title="Coming soon"
        className={cn(base, 'text-sidebar-foreground/30 cursor-not-allowed')}
      >
        {icon}
        <span>{label}</span>
      </span>
    )
  }

  return (
    <Link
      href={href}
      className={cn(
        base,
        isActive
          ? 'border-l-2 border-primary bg-sidebar-accent text-sidebar-accent-foreground font-medium pl-[10px]'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border-l-2 border-transparent pl-[10px]'
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  )
}
```

Note: `pl-[10px]` on both states keeps the icon aligned (the `border-l-2` takes 2px, so `px-3` = 12px minus 2px = 10px for consistent alignment on both states).

- [ ] **Step 2: Lint check**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/nav-link.tsx
git commit -m "feat(admin): NavLink — crimson left-border active state, tighter padding, Coming Soon tooltip"
```

---

## Task 5: Rewrite the Dashboard page

**Files:**
- Modify: `app/(admin)/admin/dashboard/page.tsx`

Four stat cards (Pending Enrollments, Total Students, Active Courses, Total Enrollments) + a quick stats line + a compact recent-pending table. All data from three parallel `db` queries.

- [ ] **Step 1: Rewrite dashboard page**

```tsx
// app/(admin)/admin/dashboard/page.tsx
import Link from 'next/link'
import { Clock, GraduationCap, BookOpen, Users, ChevronRight } from 'lucide-react'
import { db } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/admin/page-header'

export const metadata = { title: 'Dashboard — AQA Admin' }

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export default async function AdminDashboardPage() {
  const [pendingCount, studentCount, publishedCourseCount, approvedCount, recentPending] =
    await Promise.all([
      db.enrollmentRequest.count({ where: { status: 'PENDING' } }),
      db.user.count({ where: { role: 'STUDENT', isActive: true } }),
      db.course.count({ where: { isPublished: true } }),
      db.enrollmentRequest.count({ where: { status: 'APPROVED' } }),
      db.enrollmentRequest.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { course: { select: { title: true } } },
      }),
    ])

  const stats = [
    {
      label: 'Pending Reviews',
      value: pendingCount,
      icon: Clock,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      href: '/admin/enrollments?tab=pending',
    },
    {
      label: 'Active Students',
      value: studentCount,
      icon: GraduationCap,
      iconBg: 'bg-muted',
      iconColor: 'text-muted-foreground',
      href: null,
    },
    {
      label: 'Published Courses',
      value: publishedCourseCount,
      icon: BookOpen,
      iconBg: 'bg-muted',
      iconColor: 'text-muted-foreground',
      href: '/admin/courses',
    },
    {
      label: 'Total Enrollments',
      value: approvedCount,
      icon: Users,
      iconBg: 'bg-muted',
      iconColor: 'text-muted-foreground',
      href: null,
    },
  ]

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <PageHeader title="Dashboard" />

      <p className="text-sm text-muted-foreground -mt-4">
        {pendingCount} pending · {studentCount} students · {publishedCourseCount} courses
      </p>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          const card = (
            <div className="p-4 border rounded-lg bg-card space-y-3">
              <div className={`w-8 h-8 rounded-md flex items-center justify-center ${stat.iconBg}`}>
                <Icon className={`w-4 h-4 ${stat.iconColor}`} aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            </div>
          )
          return stat.href ? (
            <Link key={stat.label} href={stat.href} className="hover:opacity-80 transition-opacity">
              {card}
            </Link>
          ) : (
            <div key={stat.label}>{card}</div>
          )
        })}
      </div>

      {/* Recent pending requests */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Recent Pending Reviews</h2>
          <Link
            href="/admin/enrollments?tab=pending"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all →
          </Link>
        </div>

        {recentPending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending reviews. You&apos;re all caught up.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Name</th>
                  <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Course</th>
                  <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Submitted</th>
                  <th scope="col" aria-label="Actions" className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentPending.map((req) => (
                  <tr key={req.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-2 font-medium">{req.firstName} {req.lastName}</td>
                    <td className="px-4 py-2 text-muted-foreground">{req.course.title}</td>
                    <td className="px-4 py-2 text-muted-foreground">{dateFormatter.format(req.createdAt)}</td>
                    <td className="px-4 py-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={'/admin/enrollments/' + req.id}>
                          Review
                          <ChevronRight className="w-3 h-3 ml-1" aria-hidden="true" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Lint check**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/admin/dashboard/page.tsx
git commit -m "feat(admin): dashboard — stat cards, quick stats line, recent pending requests table"
```

---

## Task 6: Update Enrollments list page

**Files:**
- Modify: `app/(admin)/admin/enrollments/page.tsx`

Changes: show counts on all tabs (not just active) via a `groupBy` query, compact `py-2` rows, "View" ghost button with chevron, icon empty state, `<PageHeader>`.

- [ ] **Step 1: Rewrite enrollments page**

```tsx
// app/(admin)/admin/enrollments/page.tsx
import { type EnrollmentStatus } from '@prisma/client'
import { db } from '@/lib/db'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Inbox, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/admin/page-header'

type Props = {
  searchParams: Promise<{ tab?: string }>
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export const metadata = { title: 'Enrollments — AQA Admin' }

export default async function EnrollmentsPage({ searchParams }: Props) {
  const { tab } = await searchParams

  const STATUS_MAP: Record<string, EnrollmentStatus> = {
    pending: 'PENDING',
    approved: 'APPROVED',
    rejected: 'REJECTED',
  }
  const status: EnrollmentStatus = STATUS_MAP[tab ?? ''] ?? 'PENDING'

  const [requests, statusCounts] = await Promise.all([
    db.enrollmentRequest.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      include: { course: { select: { title: true } } },
    }),
    db.enrollmentRequest.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
  ])

  const countMap = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count._all])
  ) as Record<string, number>

  const tabs = [
    { label: 'Pending', value: 'pending', enumStatus: 'PENDING' as EnrollmentStatus },
    { label: 'Approved', value: 'approved', enumStatus: 'APPROVED' as EnrollmentStatus },
    { label: 'Rejected', value: 'rejected', enumStatus: 'REJECTED' as EnrollmentStatus },
  ]

  const getStatusBadge = (s: EnrollmentStatus) => {
    if (s === 'APPROVED')
      return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>
    if (s === 'REJECTED')
      return <Badge variant="destructive">Rejected</Badge>
    return <Badge variant="outline">Pending</Badge>
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Enrollment Requests"
        breadcrumbs={[{ label: 'Enrollments' }]}
      />

      {/* Tab bar */}
      <div className="flex gap-1 border-b -mt-2">
        {tabs.map((t) => {
          const isActive = t.enumStatus === status
          const count = countMap[t.enumStatus] ?? 0
          return (
            <Link
              key={t.value}
              href={`?tab=${t.value}`}
              className={cn(
                'flex items-center gap-1.5 px-4 pb-3 text-sm transition-colors',
                isActive
                  ? 'border-b-2 border-primary text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
              <span className="inline-block bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-xs font-medium">
                {count}
              </span>
            </Link>
          )
        })}
      </div>

      {requests.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Inbox className="w-8 h-8" aria-hidden="true" />
          <p className="text-sm">No {status.toLowerCase()} requests.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Name</th>
                <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Email</th>
                <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Course</th>
                <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Submitted</th>
                <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th scope="col" aria-label="Actions" className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {requests.map((request) => (
                <tr key={request.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-2 font-medium">{request.firstName} {request.lastName}</td>
                  <td className="px-4 py-2 text-muted-foreground">{request.email}</td>
                  <td className="px-4 py-2">{request.course.title}</td>
                  <td className="px-4 py-2 text-muted-foreground">{dateFormatter.format(request.createdAt)}</td>
                  <td className="px-4 py-2">{getStatusBadge(request.status)}</td>
                  <td className="px-4 py-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={'/admin/enrollments/' + request.id}>
                        View <ChevronRight className="w-3 h-3 ml-1" aria-hidden="true" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

Note: `db.enrollmentRequest.findMany` replaces the former `getEnrollmentRequestsByStatus` helper since we now need two queries in parallel anyway. The `include: { course: ... }` matches what the original helper returned.

- [ ] **Step 2: Lint check**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/admin/enrollments/page.tsx
git commit -m "feat(admin): enrollments list — all-tab counts, compact rows, ghost buttons, icon empty state"
```

---

## Task 7: Update Courses list page

**Files:**
- Modify: `app/(admin)/admin/courses/page.tsx`

Changes: `PageHeader` with action slot (New Course button), `py-2` rows, ghost "View" button with chevron, icon empty state.

- [ ] **Step 1: Rewrite courses list page**

```tsx
// app/(admin)/admin/courses/page.tsx
import { getCourses } from '@/lib/courses/queries'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BookOpen, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/admin/page-header'

export const metadata = { title: 'Courses — AQA Admin' }

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export default async function CoursesPage() {
  const courses = await getCourses()

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Courses"
        breadcrumbs={[{ label: 'Courses' }]}
        action={
          <Button asChild>
            <Link href="/admin/courses/new">New Course</Link>
          </Button>
        }
      />

      {courses.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <BookOpen className="w-8 h-8" aria-hidden="true" />
          <p className="text-sm">No courses yet. Create your first course.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Title</th>
                <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Subjects</th>
                <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Passing Grade</th>
                <th scope="col" className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Created</th>
                <th scope="col" aria-label="Actions" className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {courses.map((course) => (
                <tr key={course.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-2 font-medium">{course.title}</td>
                  <td className="px-4 py-2">
                    {course.isPublished
                      ? <Badge className="bg-green-100 text-green-800 border-green-200">Published</Badge>
                      : <Badge variant="outline">Draft</Badge>}
                  </td>
                  <td className="px-4 py-2">{course._count.subjects}</td>
                  <td className="px-4 py-2">{course.passingGrade}%</td>
                  <td className="px-4 py-2 text-muted-foreground">{dateFormatter.format(course.createdAt)}</td>
                  <td className="px-4 py-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={'/admin/courses/' + course.id}>
                        View <ChevronRight className="w-3 h-3 ml-1" aria-hidden="true" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Lint check**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/admin/courses/page.tsx
git commit -m "feat(admin): courses list — PageHeader, compact rows, ghost buttons, icon empty state"
```

---

## Task 8: Update Users page

**Files:**
- Modify: `app/(admin)/admin/users/page.tsx`

Changes: fix layout from `max-w-4xl mx-auto py-8 px-4` to `p-6 max-w-5xl`, add `<PageHeader>`.

- [ ] **Step 1: Update users page layout**

```tsx
// app/(admin)/admin/users/page.tsx
import { Suspense } from 'react'
import { getUsersByRole } from '@/lib/users/queries'
import { TabSwitcher } from './tab-switcher'
import { UserTable } from './user-table'
import { CreateUserForm } from './create-user-form'
import { PageHeader } from '@/components/admin/page-header'

type Props = {
  searchParams: Promise<{ tab?: string }>
}

export default async function UsersPage({ searchParams }: Props) {
  const { tab } = await searchParams
  const activeTab = tab === 'teachers' ? 'teachers' : 'admins'
  const role = activeTab === 'admins' ? 'ADMIN' : 'TEACHER'
  const roleLabel = activeTab === 'admins' ? 'Admin' : 'Teacher'

  const users = await getUsersByRole(role)

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <PageHeader
        title="Users"
        breadcrumbs={[{ label: 'Users' }]}
      />
      <Suspense fallback={null}>
        <TabSwitcher activeTab={activeTab} />
      </Suspense>
      <UserTable users={users} role={activeTab} />
      <CreateUserForm role={role} roleLabel={roleLabel} />
    </div>
  )
}
```

- [ ] **Step 2: Lint check**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/admin/users/page.tsx
git commit -m "feat(admin): users page — align layout to p-6 max-w-5xl, add PageHeader"
```

---

## Task 9: Add breadcrumbs to detail pages

**Files:**
- Modify: `app/(admin)/admin/courses/[id]/page.tsx`
- Modify: `app/(admin)/admin/enrollments/[id]/page.tsx`
- Modify: `app/(admin)/admin/courses/[id]/subjects/[sid]/page.tsx`

Each detail page replaces its ad-hoc heading block with `<PageHeader>` carrying a breadcrumb trail. The inline "Back to X" `<Link>` is removed (the breadcrumb supersedes it).

- [ ] **Step 1: Update Course detail page heading**

In `app/(admin)/admin/courses/[id]/page.tsx`, replace:

```tsx
      <Link
        href="/admin/courses"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to Courses
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{course.title}</h1>
        {course.isPublished ? (
          <Badge className="bg-green-100 text-green-800 border-green-200">Published</Badge>
        ) : (
          <Badge variant="outline">Draft</Badge>
        )}
      </div>
```

with:

```tsx
      <PageHeader
        breadcrumbs={[
          { label: 'Courses', href: '/admin/courses' },
          { label: course.title },
        ]}
        title={course.title}
        action={
          course.isPublished
            ? <Badge className="bg-green-100 text-green-800 border-green-200">Published</Badge>
            : <Badge variant="outline">Draft</Badge>
        }
      />
```

Also add the import at the top of the file:
```tsx
import { PageHeader } from '@/components/admin/page-header'
```

And remove the `ArrowLeft` import from lucide-react if it's no longer used elsewhere in the file.

- [ ] **Step 2: Update Enrollment detail page heading**

In `app/(admin)/admin/enrollments/[id]/page.tsx`, replace:

```tsx
      <Link
        href="/admin/enrollments"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to Enrollments
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">
          {request.firstName} {request.lastName}
        </h1>
        <StatusBadge status={request.status} />
      </div>
```

with:

```tsx
      <PageHeader
        breadcrumbs={[
          { label: 'Enrollments', href: '/admin/enrollments' },
          { label: `${request.firstName} ${request.lastName}` },
        ]}
        title={`${request.firstName} ${request.lastName}`}
        action={<StatusBadge status={request.status} />}
      />
```

Add the import:
```tsx
import { PageHeader } from '@/components/admin/page-header'
```

Remove `ArrowLeft` from the lucide-react import if unused.

- [ ] **Step 3: Update Subject detail page heading**

In `app/(admin)/admin/courses/[id]/subjects/[sid]/page.tsx`, replace:

```tsx
      <Link
        href={'/admin/courses/' + id}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to {subject.course.title}
      </Link>

      <h1 className="text-2xl font-semibold">{subject.title}</h1>
```

with:

```tsx
      <PageHeader
        breadcrumbs={[
          { label: 'Courses', href: '/admin/courses' },
          { label: subject.course.title, href: '/admin/courses/' + id },
          { label: subject.title },
        ]}
        title={subject.title}
      />
```

Add the import:
```tsx
import { PageHeader } from '@/components/admin/page-header'
```

Remove `ArrowLeft` from the lucide-react import if unused.

- [ ] **Step 4: Lint check**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/admin/courses/[id]/page.tsx" "app/(admin)/admin/enrollments/[id]/page.tsx" "app/(admin)/admin/courses/[id]/subjects/[sid]/page.tsx"
git commit -m "feat(admin): detail pages — replace back links with PageHeader breadcrumbs"
```

---

## Task 10: Final build verification

- [ ] **Step 1: Run full production build**

```bash
pnpm build
```

Expected: successful build with no TypeScript errors. If the build flags missing fields (e.g., `isActive` on `User`), check the Prisma schema and adjust the query accordingly.

- [ ] **Step 2: Start dev server and do a visual smoke test**

```bash
pnpm dev
```

Visit each page and verify:
- Sidebar is dark zinc with crimson AQA logo mark
- Active nav item has crimson left border
- Dashboard shows 4 stat cards and recent pending table
- Enrollments list shows counts on all 3 tabs
- Courses list has compact rows and ghost "View" buttons
- Course detail / enrollment detail / subject detail pages show breadcrumb trail
- Users page is left-aligned (not centered)

- [ ] **Step 3: Commit if any minor fixes were needed**

```bash
git add -p   # stage only the fix files
git commit -m "fix(admin): address build-time type errors in UI redesign"
```
