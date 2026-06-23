# Students Management Page — Design Spec

**Date:** 2026-06-23  
**Status:** Approved

## Overview

Add a dedicated Students management section to the admin panel. Admins can view all enrolled students, filter by course and gender, export the filtered list as CSV, and drill into a per-student detail page.

## Schema Changes

Add a `Gender` enum and an optional `gender` field to `User`:

```prisma
enum Gender {
  MALE
  FEMALE
}

model User {
  // ... existing fields ...
  gender Gender?
}
```

`gender` is optional so existing student records remain valid without a migration default.

## Routes

```
/admin/students           → list page
/admin/students/[id]      → detail page
/api/admin/students/export → CSV export (GET)
```

## File Structure

```
app/(admin)/admin/students/
  page.tsx               Server Component — list page
  filter-bar.tsx         Client Component — course + gender dropdowns
  student-table.tsx      Server Component — table of students
  [id]/
    page.tsx             Server Component — student detail page

app/api/admin/students/export/
  route.ts               GET handler — returns text/csv

lib/students/
  queries.ts             Shared query functions
```

## Data Layer (`lib/students/queries.ts`)

Two query functions:

**`getStudents({ courseId?, gender? })`** — returns students with `role: STUDENT`, filtered by the given params. Each row includes: id, firstName, lastName, email, gender, isActive, createdAt, and their enrollments (courseId, course title, enrolledAt).

**`getStudentById(id)`** — returns a single student with full enrollment details: course title, enrolledAt, completedAt, progress, paymentStatus.

## List Page (`/admin/students/page.tsx`)

Server Component. Reads `searchParams` for `course` and `gender`, calls `getStudents()`, passes results to `StudentTable`. Renders `FilterBar` above the table.

Layout: `p-6 max-w-5xl space-y-6` — consistent with other admin pages.

### FilterBar (`filter-bar.tsx`)

Client Component. Two `<select>` dropdowns:

- **Course** — options populated from all courses (fetched in the list page and passed as a prop). Value is `courseId`.
- **Gender** — `Male | Female` options.

On change: `router.push('/admin/students?' + new URLSearchParams({...}))`.  
"Clear filters" link resets to `/admin/students`.

**Export CSV button** — rendered as `<a href="/api/admin/students/export?course=...&gender=...">` with the current params, so it always exports the filtered view. No JS needed.

### StudentTable (`student-table.tsx`)

Columns: Name | Email | Gender | Course(s) | Enrolled | Status | →

- Each row links to `/admin/students/[id]` via a chevron button.
- Courses column: comma-separated list of enrolled course titles.
- Status badge: Active (green) / Inactive (zinc) — same style as `user-table.tsx`.
- Empty state: icon + "No students found." message, consistent with enrollments page.

## Detail Page (`/admin/students/[id]/page.tsx`)

Server Component. Calls `getStudentById(id)`, throws 404 if not found.

**PageHeader** — title: student full name, breadcrumb: `Students → [Name]`.

**Profile card** — key-value pairs: Name, Email, Gender, Status, Member since.

**Enrollments table** — columns: Course | Enrolled | Progress | Payment Status.  
Empty state shown inline if no enrollments.

Read-only — no actions on this page.

## Export API (`/api/admin/students/export/route.ts`)

GET handler. Reads `course` and `gender` from `request.nextUrl.searchParams`. Runs the same `getStudents()` query. Builds a CSV string with headers:

```
Name,Email,Gender,Course,Enrolled Date,Status
```

Returns `Response` with `Content-Type: text/csv` and `Content-Disposition: attachment; filename="students.csv"`.

One row per student. The Course column contains a semicolon-separated list of enrolled course titles (e.g. `"Course A; Course B"`) so the CSV row stays flat.

No external library needed — plain string construction is sufficient for this data shape.

## Navigation

Add a `NavLink` to `app/(admin)/layout.tsx` between Enrollments and Users:

```tsx
<NavLink
  href="/admin/students"
  icon={<GraduationCap className="w-4 h-4" aria-hidden="true" />}
  label="Students"
/>
```

## What's Out of Scope

- Editing student profiles from this page
- Pagination (query uses a reasonable `take` limit for now)
- Student detail actions (deactivate, re-enroll, etc.)
