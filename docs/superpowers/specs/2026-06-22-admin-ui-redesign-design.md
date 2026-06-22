# Admin UI Redesign — Phase 1: Shell, Dashboard & Shared Patterns

**Date:** 2026-06-22
**Scope:** Phase 1 of a phased admin UI redesign. Covers the layout shell (sidebar + top bar), dashboard page, and shared component patterns (tables, page headers). Enrollments and courses UX improvements are Phase 2 and Phase 3.

---

## Context & Goals

The current admin UI is functional but barebones: a near-white sidebar, an empty dashboard, plain HTML tables with oversized rows, and inconsistent page layouts. The target audience is one or two dedicated daily admins who need density and speed over discoverability.

The visual direction is **dark sidebar + light content** (Linear/Vercel style), using the existing project color scheme — dark zinc chrome, crimson primary accent — matching the homepage's identity without requiring new design tokens.

---

## Section 1: Shell

### Sidebar

The `<aside>` in `app/(admin)/layout.tsx` receives `class="dark"` to activate the existing dark sidebar CSS vars:
- `--sidebar` becomes `oklch(0.205 0 0)` (dark zinc) — matching the homepage hero background.
- `--sidebar-primary` becomes `oklch(0.656 0.241 354.308)` (crimson) — used for active states.
- No new color tokens required.

**Logo area** — replace plain `<p>Al-Qur'an Academy</p>` with the AQA logo mark: a crimson-bordered circle with "AQA" inside, brand name and "INTERNATIONAL" subtitle below. Mirrors the public `Navbar` component exactly.

**Nav items** — `NavLink` in `app/(admin)/nav-link.tsx`:
- Padding: `px-3 py-2` (down from `px-4 py-2`).
- Active state: `border-l-2 border-primary bg-sidebar-accent text-sidebar-accent-foreground font-medium`.
- Inactive: `text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground`.
- Disabled items (Reports): retain `opacity-50 cursor-not-allowed`, add `title="Coming soon"` tooltip.

**Bottom user chip** — above the Logout button, show a user identity row:
- Small circle avatar (crimson background, white initial of the logged-in user's name).
- Name and role label (`text-xs text-sidebar-foreground/60`).
- Logout button below, styled consistently with nav items (icon + label, hover accent).
- Session data is already available via `getSession()` — pass it as a prop from the layout.

### Top Header Bar

A new `<header>` element at the top of `<main>` in the layout. Not a separate layout file — injected as a sticky bar inside the main content scroll area.

- Height: `h-12`.
- Styles: `bg-background border-b border-border sticky top-0 z-10 px-6 flex items-center`.
- **Left slot**: `<Breadcrumb>` component (see Shared Patterns). Populated per-page.
- **Right slot**: empty in Phase 1, reserved for search/notifications.

The layout's `<main>` becomes:
```
<main className="flex-1 overflow-auto flex flex-col">
  <TopBar /> {/* sticky */}
  <div className="flex-1">{children}</div>
</main>
```

Each page passes its breadcrumb context via a `<PageHeader>` component rendered at the top of its own content div.

---

## Section 2: Dashboard

File: `app/(admin)/admin/dashboard/page.tsx`

### Stat Cards

A `grid grid-cols-2 lg:grid-cols-4 gap-4` row of four cards:

| Card | Icon | Data source | Behaviour |
|---|---|---|---|
| Pending Enrollments | `Clock` (crimson tinted) | `count(EnrollmentRequest where status=PENDING)` | Links to `/admin/enrollments?tab=pending` |
| Total Students | `GraduationCap` | `count(User where role=STUDENT and isActive=true)` | Non-interactive |
| Active Courses | `BookOpen` | `count(Course where isPublished=true)` | Links to `/admin/courses` |
| Total Enrollments | `Users` | `count(EnrollmentRequest where status=APPROVED)` | Non-interactive |

Card anatomy:
- `p-4 border rounded-lg bg-card` — no heavy shadow.
- Icon in a small `w-8 h-8 rounded-md` container (muted bg, crimson bg for Pending card).
- Large number in `text-2xl font-bold`.
- Muted label in `text-xs text-muted-foreground mt-0.5`.
- Pending card wraps in a `<Link>` to `/admin/enrollments?tab=pending`.

### Quick Stats Line

Below the page `<h1>`, a single `<p className="text-sm text-muted-foreground">` showing:
`"N pending · N students · N courses"` — derived from the same queries, no extra DB round-trips.

### Recent Pending Requests Table

A compact table of the 5 most recent `PENDING` enrollment requests:
- Columns: Name, Course, Submitted date, action button.
- Action: `<Button variant="outline" size="sm" asChild><Link href={...}>Review</Link></Button>`.
- Section header: `"Recent Pending Reviews"` with a `"View all →"` link (right-aligned) to `/admin/enrollments?tab=pending`.
- If no pending requests: a single muted empty state row (`"No pending reviews"`).

All data fetched in one `async` server component. Three parallel queries via `Promise.all`.

---

## Section 3: Shared Patterns

### Table Pattern

Applied to all existing list tables (enrollments, courses, subjects, lessons, users). No new component — standardized Tailwind classes:

- Row padding: `py-2` (down from `py-3`). ~30% more rows visible without scrolling.
- `"View →"` text links → `<Button variant="ghost" size="sm" asChild><Link>View <ChevronRight className="w-3 h-3 ml-1" /></Link></Button>`.
- Mixed action cells (Edit text + DeleteButton) → `<div className="flex items-center gap-1">` containing ghost-sm buttons.
- Empty states: small icon (relevant to section) above a muted `<p>`. One-line treatment, no illustration.

### Tab Count Fix (Enrollments)

The Enrollments list page currently shows the count badge only on the active tab. Change: fetch counts for all three statuses in a single query (`groupBy status`) and show a count badge on every tab. This removes the need to click to each tab to know the queue depth.

### `<PageHeader>` Component

New shared server component at `components/admin/page-header.tsx`:

```tsx
type Props = {
  breadcrumbs?: { label: string; href?: string }[]
  title: string
  action?: React.ReactNode
}
```

Renders:
- Breadcrumb trail: ancestors as `<Link>` in `text-muted-foreground text-sm`, separator `/`, current page as `text-foreground text-sm font-medium`.
- `<h1 className="text-xl font-semibold mt-1">{title}</h1>`
- Optional right-aligned `action` slot (e.g., "New Course" button).

All existing pages replace their ad-hoc header `<div>` blocks with `<PageHeader>`.

### Layout Consistency Fix

Users page (`app/(admin)/admin/users/page.tsx`) moves from `max-w-4xl mx-auto py-8 px-4` to `p-6 max-w-5xl` to match all other admin pages.

---

## What This Does NOT Include (Phase 1)

- Search or filtering on any list page (Phase 2+).
- Pagination (Phase 2+).
- Enrollments detail page UX improvements (Phase 2).
- Course hierarchy UX improvements (Phase 3).
- Dark mode toggle (not planned — admin stays light-content with dark sidebar).
- Reports page (disabled, no ETA).

---

## File Change Summary

| File | Change |
|---|---|
| `app/(admin)/layout.tsx` | Add `dark` class to `<aside>`, replace logo text with logo mark, update bottom with user chip, add `<TopBar>` to main |
| `app/(admin)/nav-link.tsx` | Tighter padding, crimson left-border active state |
| `app/(admin)/admin/dashboard/page.tsx` | Full rewrite — stat cards, quick stats line, recent requests table |
| `app/(admin)/admin/enrollments/page.tsx` | Tab counts for all statuses, compact row padding, ghost action buttons |
| `app/(admin)/admin/courses/page.tsx` | Compact rows, ghost action buttons, `<PageHeader>` |
| `app/(admin)/admin/users/page.tsx` | Fix layout to `p-6 max-w-5xl`, `<PageHeader>` |
| `app/(admin)/admin/courses/[id]/page.tsx` | `<PageHeader>` with breadcrumb |
| `app/(admin)/admin/courses/[id]/subjects/[sid]/page.tsx` | `<PageHeader>` with breadcrumb |
| `app/(admin)/admin/enrollments/[id]/page.tsx` | `<PageHeader>` with breadcrumb |
| `components/admin/page-header.tsx` | New shared component |
| `components/admin/top-bar.tsx` | New sticky top bar |
