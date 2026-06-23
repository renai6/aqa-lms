# Students Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/admin/students` section with a filterable student list, CSV export, and a per-student detail page.

**Architecture:** URL search params drive server-side filtering (same pattern as `/admin/enrollments`). A client `FilterBar` updates the URL on change; the Server Component re-queries on navigation. Export is a plain GET API route that returns `text/csv`. A `gender` field is added to `User` via a Prisma migration.

**Tech Stack:** Next.js 15 App Router, Prisma 7, TypeScript, Tailwind CSS 4, shadcn/ui, lucide-react

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `prisma/schema.prisma` | Modify | Add `Gender` enum + optional `gender` field to `User` |
| `lib/students/queries.ts` | Create | `getStudents()` and `getStudentById()` query functions |
| `app/(admin)/admin/students/page.tsx` | Create | List page — Server Component, reads searchParams |
| `app/(admin)/admin/students/student-table.tsx` | Create | Table of student rows |
| `app/(admin)/admin/students/filter-bar.tsx` | Create | Client component — course + gender dropdowns + export link |
| `app/(admin)/admin/students/[id]/page.tsx` | Create | Detail page — profile card + enrollments table |
| `app/api/admin/students/export/route.ts` | Create | GET handler returning CSV |
| `app/(admin)/layout.tsx` | Modify | Add Students nav link |

---

## Task 1: Schema — Add Gender enum to User

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Gender enum and field to schema**

In `prisma/schema.prisma`, add the enum after the existing enums block (e.g. after `PaymentStatus`):

```prisma
enum Gender {
  MALE
  FEMALE
}
```

Then add the field to the `User` model, after `isActive`:

```prisma
model User {
  id           String @id @default(cuid())
  email        String @unique
  passwordHash String

  firstName   String
  lastName    String
  displayName String?

  role               UserRole @default(STUDENT)
  isActive           Boolean  @default(true)
  gender             Gender?
  mustChangePassword Boolean  @default(false)

  // ... rest unchanged
}
```

- [ ] **Step 2: Run migration**

```bash
pnpm prisma migrate dev --name add-gender-to-user
```

Expected: migration file created, schema applied, client regenerated. No data loss — `gender` is optional.

- [ ] **Step 3: Verify client picks up new type**

```bash
pnpm prisma generate
```

Expected: completes without error. `Gender` is now importable from `@prisma/client`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add Gender enum and optional gender field to User"
```

---

## Task 2: Data Layer — Student Query Functions

**Files:**
- Create: `lib/students/queries.ts`

- [ ] **Step 1: Create the query file**

```typescript
// lib/students/queries.ts
import { Gender, PaymentStatus } from '@prisma/client'
import { db } from '@/lib/db'

export type StudentRow = {
  id: string
  firstName: string
  lastName: string
  email: string
  gender: Gender | null
  isActive: boolean
  createdAt: Date
  enrollments: {
    courseId: string
    courseTitle: string
    enrolledAt: Date
  }[]
}

export type StudentDetail = {
  id: string
  firstName: string
  lastName: string
  email: string
  gender: Gender | null
  isActive: boolean
  createdAt: Date
  enrollments: {
    courseId: string
    courseTitle: string
    enrolledAt: Date
    completedAt: Date | null
    progress: number
    paymentStatus: PaymentStatus
  }[]
}

export async function getStudents({
  courseId,
  gender,
}: {
  courseId?: string
  gender?: Gender
} = {}): Promise<StudentRow[]> {
  const users = await db.user.findMany({
    where: {
      role: 'STUDENT',
      ...(gender ? { gender } : {}),
      ...(courseId ? { enrollments: { some: { courseId } } } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      gender: true,
      isActive: true,
      createdAt: true,
      enrollments: {
        select: {
          courseId: true,
          enrolledAt: true,
          course: { select: { title: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return users.map((u) => ({
    ...u,
    enrollments: u.enrollments.map((e) => ({
      courseId: e.courseId,
      courseTitle: e.course.title,
      enrolledAt: e.enrolledAt,
    })),
  }))
}

export async function getStudentById(id: string): Promise<StudentDetail | null> {
  const user = await db.user.findFirst({
    where: { id, role: 'STUDENT' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      gender: true,
      isActive: true,
      createdAt: true,
      enrollments: {
        select: {
          courseId: true,
          enrolledAt: true,
          completedAt: true,
          progress: true,
          paymentStatus: true,
          course: { select: { title: true } },
        },
      },
    },
  })

  if (!user) return null

  return {
    ...user,
    enrollments: user.enrollments.map((e) => ({
      courseId: e.courseId,
      courseTitle: e.course.title,
      enrolledAt: e.enrolledAt,
      completedAt: e.completedAt,
      progress: e.progress,
      paymentStatus: e.paymentStatus,
    })),
  }
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm build
```

Expected: no TypeScript errors in `lib/students/queries.ts`. (Other errors unrelated to this file can be ignored for now.)

- [ ] **Step 3: Commit**

```bash
git add lib/students/queries.ts
git commit -m "feat(students): add getStudents and getStudentById query functions"
```

---

## Task 3: Student Table Component

**Files:**
- Create: `app/(admin)/admin/students/student-table.tsx`

- [ ] **Step 1: Create the component**

```tsx
// app/(admin)/admin/students/student-table.tsx
import Link from 'next/link'
import { ChevronRight, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { StudentRow } from '@/lib/students/queries'

type Props = { students: StudentRow[] }

export function StudentTable({ students }: Props) {
  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <Inbox className="w-8 h-8" aria-hidden="true" />
        <p className="text-sm">No students found.</p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Name</th>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Email</th>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Gender</th>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Course(s)</th>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Enrolled</th>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
            <th scope="col" aria-label="Actions" className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {students.map((s) => (
            <tr key={s.id} className="hover:bg-muted/50 transition-colors">
              <td className="px-4 py-3 font-medium">{s.firstName} {s.lastName}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.email}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {s.gender ? (s.gender === 'MALE' ? 'Male' : 'Female') : '—'}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {s.enrollments.length > 0
                  ? s.enrollments.map((e) => e.courseTitle).join(', ')
                  : '—'}
              </td>
              <td className="px-4 py-3 text-muted-foreground text-xs">
                {s.enrollments[0]
                  ? s.enrollments[0].enrolledAt.toLocaleDateString()
                  : '—'}
              </td>
              <td className="px-4 py-3">
                <span className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                  s.isActive ? 'bg-green-100 text-green-800' : 'bg-zinc-100 text-zinc-600',
                )}>
                  {s.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-4 py-3">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/admin/students/${s.id}`}>
                    <ChevronRight className="w-3 h-3" aria-hidden="true" />
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(admin\)/admin/students/student-table.tsx
git commit -m "feat(students): add StudentTable component"
```

---

## Task 4: Filter Bar Component

**Files:**
- Create: `app/(admin)/admin/students/filter-bar.tsx`

- [ ] **Step 1: Create the component**

```tsx
// app/(admin)/admin/students/filter-bar.tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download } from 'lucide-react'

type Course = { id: string; title: string }

type Props = {
  courses: Course[]
  currentCourse?: string
  currentGender?: string
  exportHref: string
}

export function FilterBar({ courses, currentCourse, currentGender, exportHref }: Props) {
  const router = useRouter()

  function handleChange(key: string, value: string) {
    const params = new URLSearchParams()
    if (key !== 'course' && currentCourse) params.set('course', currentCourse)
    if (key !== 'gender' && currentGender) params.set('gender', currentGender)
    if (value) params.set(key, value)
    router.push('/admin/students' + (params.size ? '?' + params.toString() : ''))
  }

  const hasFilters = currentCourse || currentGender

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <select
        value={currentCourse ?? ''}
        onChange={(e) => handleChange('course', e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All courses</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>{c.title}</option>
        ))}
      </select>

      <select
        value={currentGender ?? ''}
        onChange={(e) => handleChange('gender', e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All genders</option>
        <option value="MALE">Male</option>
        <option value="FEMALE">Female</option>
      </select>

      {hasFilters && (
        <Link
          href="/admin/students"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear filters
        </Link>
      )}

      <a
        href={exportHref}
        className="ml-auto flex items-center gap-1.5 h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-muted transition-colors"
      >
        <Download className="w-3.5 h-3.5" aria-hidden="true" />
        Export CSV
      </a>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(admin\)/admin/students/filter-bar.tsx
git commit -m "feat(students): add FilterBar component"
```

---

## Task 5: List Page

**Files:**
- Create: `app/(admin)/admin/students/page.tsx`

- [ ] **Step 1: Create the list page**

```tsx
// app/(admin)/admin/students/page.tsx
import { Suspense } from 'react'
import { type Gender } from '@prisma/client'
import { db } from '@/lib/db'
import { getStudents } from '@/lib/students/queries'
import { PageHeader } from '@/components/admin/page-header'
import { FilterBar } from './filter-bar'
import { StudentTable } from './student-table'

type Props = {
  searchParams: Promise<{ course?: string; gender?: string }>
}

export const metadata = { title: 'Students — AQA Admin' }

export default async function StudentsPage({ searchParams }: Props) {
  const { course, gender } = await searchParams

  const validGender =
    gender === 'MALE' || gender === 'FEMALE' ? (gender as Gender) : undefined

  const [students, courses] = await Promise.all([
    getStudents({ courseId: course, gender: validGender }),
    db.course.findMany({
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    }),
  ])

  const exportParams = new URLSearchParams()
  if (course) exportParams.set('course', course)
  if (gender) exportParams.set('gender', gender)
  const exportHref =
    '/api/admin/students/export' +
    (exportParams.size ? '?' + exportParams.toString() : '')

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <PageHeader title="Students" />
      <Suspense fallback={null}>
        <FilterBar
          courses={courses}
          currentCourse={course}
          currentGender={gender}
          exportHref={exportHref}
        />
      </Suspense>
      <StudentTable students={students} />
    </div>
  )
}
```

- [ ] **Step 2: Type-check and verify**

```bash
pnpm build
```

Expected: no errors in the students directory.

- [ ] **Step 3: Smoke-test in dev**

```bash
pnpm dev
```

Open `http://localhost:3000/admin/students`. Expect: page renders with PageHeader "Students", two dropdowns, Export CSV button, and a table (or empty state).

- [ ] **Step 4: Commit**

```bash
git add app/\(admin\)/admin/students/page.tsx
git commit -m "feat(students): add students list page with filter and table"
```

---

## Task 6: Student Detail Page

**Files:**
- Create: `app/(admin)/admin/students/[id]/page.tsx`

- [ ] **Step 1: Create the detail page**

```tsx
// app/(admin)/admin/students/[id]/page.tsx
import { notFound } from 'next/navigation'
import { getStudentById } from '@/lib/students/queries'
import { PageHeader } from '@/components/admin/page-header'
import { cn } from '@/lib/utils'

type Props = { params: Promise<{ id: string }> }

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export default async function StudentDetailPage({ params }: Props) {
  const { id } = await params
  const student = await getStudentById(id)
  if (!student) notFound()

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        breadcrumbs={[
          { label: 'Students', href: '/admin/students' },
          { label: `${student.firstName} ${student.lastName}` },
        ]}
      />

      {/* Profile */}
      <div className="border rounded-lg p-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Profile
        </h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Full name</dt>
            <dd className="font-medium mt-0.5">{student.firstName} {student.lastName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="mt-0.5">{student.email}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Gender</dt>
            <dd className="mt-0.5">
              {student.gender ? (student.gender === 'MALE' ? 'Male' : 'Female') : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="mt-0.5">
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                student.isActive
                  ? 'bg-green-100 text-green-800'
                  : 'bg-zinc-100 text-zinc-600',
              )}>
                {student.isActive ? 'Active' : 'Inactive'}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Member since</dt>
            <dd className="mt-0.5">{dateFormatter.format(student.createdAt)}</dd>
          </div>
        </dl>
      </div>

      {/* Enrollments */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Enrollments
        </h2>
        {student.enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No enrollments.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Course</th>
                  <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Enrolled</th>
                  <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Progress</th>
                  <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {student.enrollments.map((e) => (
                  <tr key={e.courseId} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-medium">{e.courseTitle}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {dateFormatter.format(e.enrolledAt)}
                    </td>
                    <td className="px-4 py-3">{e.progress}%</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                        e.paymentStatus === 'FULLY_PAID'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800',
                      )}>
                        {e.paymentStatus === 'FULLY_PAID' ? 'Fully Paid' : 'Partially Paid'}
                      </span>
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

> **Note on progress:** `Enrollment.progress` is stored as a plain float (schema default: `0`). Verify in the DB whether it's stored as `0–1` (fraction) or `0–100`. If fraction, change `{e.progress}%` to `{Math.round(e.progress * 100)}%`.

- [ ] **Step 2: Smoke-test in dev**

Navigate to a student row in `/admin/students` and click through to the detail page. Verify the profile card and enrollments table render.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/admin/students/\[id\]/page.tsx
git commit -m "feat(students): add student detail page"
```

---

## Task 7: Export API Route

**Files:**
- Create: `app/api/admin/students/export/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/admin/students/export/route.ts
import { type NextRequest } from 'next/server'
import { type Gender } from '@prisma/client'
import { getStudents } from '@/lib/students/queries'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const course = searchParams.get('course') ?? undefined
  const genderParam = searchParams.get('gender')
  const gender =
    genderParam === 'MALE' || genderParam === 'FEMALE'
      ? (genderParam as Gender)
      : undefined

  const students = await getStudents({ courseId: course, gender })

  const header = 'Name,Email,Gender,Course,Enrolled Date,Status\r\n'
  const rows = students.map((s) => {
    const name = `"${s.firstName} ${s.lastName}"`
    const email = `"${s.email}"`
    const genderLabel = s.gender ? (s.gender === 'MALE' ? 'Male' : 'Female') : ''
    const courses = `"${s.enrollments.map((e) => e.courseTitle).join('; ')}"`
    const enrolledDate = s.enrollments[0]
      ? s.enrollments[0].enrolledAt.toLocaleDateString()
      : ''
    const status = s.isActive ? 'Active' : 'Inactive'
    return [name, email, genderLabel, courses, enrolledDate, status].join(',')
  })

  const csv = header + rows.join('\r\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="students.csv"',
    },
  })
}
```

- [ ] **Step 2: Test the export in dev**

With `pnpm dev` running, open:
`http://localhost:3000/api/admin/students/export`

Expected: browser downloads `students.csv`. Open the file — verify headers (`Name,Email,Gender,Course,Enrolled Date,Status`) and one row per student.

Test with a filter:
`http://localhost:3000/api/admin/students/export?gender=MALE`

Expected: only male students in the CSV.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/students/export/route.ts
git commit -m "feat(students): add CSV export API route"
```

---

## Task 8: Add Students Nav Link

**Files:**
- Modify: `app/(admin)/layout.tsx`

- [ ] **Step 1: Add GraduationCap import and NavLink**

In `app/(admin)/layout.tsx`, add `GraduationCap` to the lucide-react import:

```tsx
import {
  LayoutDashboard,
  Users,
  BookOpen,
  BarChart2,
  LogOut,
  UserCog,
  ShieldCheck,
  GraduationCap,
} from 'lucide-react'
```

Then add the NavLink between Enrollments and Users:

```tsx
<NavLink
  href="/admin/enrollments"
  icon={<Users className="w-4 h-4" aria-hidden="true" />}
  label="Enrollments"
/>
<NavLink
  href="/admin/students"
  icon={<GraduationCap className="w-4 h-4" aria-hidden="true" />}
  label="Students"
/>
<NavLink
  href="/admin/users"
  icon={<UserCog className="w-4 h-4" aria-hidden="true" />}
  label="Users"
/>
```

- [ ] **Step 2: Verify in dev**

Reload the admin panel. Confirm "Students" appears in the sidebar between Enrollments and Users, highlights correctly when on `/admin/students`, and navigates correctly.

- [ ] **Step 3: Final build check**

```bash
pnpm build
```

Expected: clean build with no TypeScript or lint errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(admin\)/layout.tsx
git commit -m "feat(admin): add Students nav link to sidebar"
```
