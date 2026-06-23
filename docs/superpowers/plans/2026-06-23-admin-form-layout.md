# Admin Form Page Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a consistent two-rule layout pattern to all admin form pages to eliminate empty horizontal space on wide screens.

**Architecture:** Two rules — create pages get a centered single-column card (`max-w-2xl mx-auto`, no sidebar); edit/detail pages drop their `max-w-*` constraint so an existing or new `grid-cols-1 lg:grid-cols-3` layout fills the full page width. Three pages already have the grid and only need their max-width removed. Two pages need a sidebar added.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, shadcn/ui Card component.

---

### Task 1: Center the New Course create page

**Files:**
- Modify: `app/(admin)/admin/courses/new/page.tsx`

- [ ] **Step 1: Add `mx-auto` to the outer container**

In `app/(admin)/admin/courses/new/page.tsx` change line 9:

```tsx
// Before
<div className="p-6 max-w-2xl space-y-6">

// After
<div className="p-6 max-w-2xl mx-auto space-y-6">
```

- [ ] **Step 2: Verify**

```bash
pnpm lint && pnpm build
```

Expected: exits 0, no type or lint errors.

- [ ] **Step 3: Commit**

```powershell
git add "app/(admin)/admin/courses/new/page.tsx"
git commit -m "feat(admin): center new course create form on wide screens"
```

---

### Task 2: Remove max-width from the three edit pages that already have sidebars

These pages use `grid-cols-1 lg:grid-cols-3` internally but a `max-w-*` on the outer container prevents the grid from reaching full page width. Removing the constraint is the only change needed.

**Files:**
- Modify: `app/(admin)/admin/courses/[id]/page.tsx`
- Modify: `app/(admin)/admin/enrollments/[id]/page.tsx`
- Modify: `app/(admin)/admin/courses/[id]/subjects/[sid]/page.tsx`

- [ ] **Step 1: Remove `max-w-5xl` from the Course edit page**

In `app/(admin)/admin/courses/[id]/page.tsx` change line 31:

```tsx
// Before
<div className="p-6 max-w-5xl space-y-6">

// After
<div className="p-6 space-y-6">
```

- [ ] **Step 2: Remove `max-w-4xl` from the Enrollment detail page**

In `app/(admin)/admin/enrollments/[id]/page.tsx` change line 52:

```tsx
// Before
<div className="p-6 max-w-4xl space-y-6">

// After
<div className="p-6 space-y-6">
```

- [ ] **Step 3: Remove `max-w-5xl` from the Subject edit page**

In `app/(admin)/admin/courses/[id]/subjects/[sid]/page.tsx` change line 31:

```tsx
// Before
<div className="p-6 max-w-5xl space-y-6">

// After
<div className="p-6 space-y-6">
```

- [ ] **Step 4: Verify**

```bash
pnpm lint && pnpm build
```

Expected: exits 0, no type or lint errors.

- [ ] **Step 5: Commit**

```powershell
git add "app/(admin)/admin/courses/[id]/page.tsx" "app/(admin)/admin/enrollments/[id]/page.tsx" "app/(admin)/admin/courses/[id]/subjects/[sid]/page.tsx"
git commit -m "feat(admin): remove max-width from edit pages to fill available width"
```

---

### Task 3: Add two-column layout to the Lesson edit page

Currently a flat single-column layout (`max-w-2xl`) with the delete button below the form. Add a `grid-cols-1 lg:grid-cols-3` grid: `EditLessonForm` in the main area, a context card (course + subject names) and the delete button in the sidebar.

**Files:**
- Modify: `app/(admin)/admin/courses/[id]/subjects/[sid]/lessons/[lid]/page.tsx`

- [ ] **Step 1: Add Card imports**

At the top of `app/(admin)/admin/courses/[id]/subjects/[sid]/lessons/[lid]/page.tsx`, the current imports are:

```tsx
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getLessonById } from '@/lib/courses/queries'
import { getSession } from '@/lib/auth/session'
import { EditLessonForm } from './edit-lesson-form'
import { DeleteLessonPageButton } from './delete-lesson-button'
```

Add the Card import after the `getSession` import:

```tsx
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getLessonById } from '@/lib/courses/queries'
import { getSession } from '@/lib/auth/session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EditLessonForm } from './edit-lesson-form'
import { DeleteLessonPageButton } from './delete-lesson-button'
```

- [ ] **Step 2: Replace the return body with a two-column layout**

The current return body in `LessonEditPage` is:

```tsx
  return (
    <div className="p-6 max-w-2xl space-y-6">
      <Link
        href={'/admin/courses/' + id + '/subjects/' + sid}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to {lesson.subject.title}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Edit Lesson</h1>
        <p className="text-muted-foreground mt-1">{lesson.subject.course.title} › {lesson.subject.title}</p>
      </div>

      <EditLessonForm lesson={lesson} courseId={id} />

      <DeleteLessonPageButton lessonId={lid} subjectId={sid} courseId={id} lessonTitle={lesson.title} />
    </div>
  )
```

Replace it with:

```tsx
  return (
    <div className="p-6 space-y-6">
      <Link
        href={'/admin/courses/' + id + '/subjects/' + sid}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to {lesson.subject.title}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Edit Lesson</h1>
        <p className="text-muted-foreground mt-1">{lesson.subject.course.title} › {lesson.subject.title}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EditLessonForm lesson={lesson} courseId={id} />
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Course</p>
                <p className="font-medium mt-0.5">{lesson.subject.course.title}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Subject</p>
                <p className="font-medium mt-0.5">{lesson.subject.title}</p>
              </div>
            </CardContent>
          </Card>
          <DeleteLessonPageButton
            lessonId={lid}
            subjectId={sid}
            courseId={id}
            lessonTitle={lesson.title}
          />
        </div>
      </div>
    </div>
  )
```

- [ ] **Step 3: Verify**

```bash
pnpm lint && pnpm build
```

Expected: exits 0, no type or lint errors.

- [ ] **Step 4: Commit**

```powershell
git add "app/(admin)/admin/courses/[id]/subjects/[sid]/lessons/[lid]/page.tsx"
git commit -m "feat(admin): add two-column layout to lesson edit page"
```

---

### Task 4: Reorganize the Student detail page to two-column

Currently a vertical stack: profile card above, enrollments table below. Swap to two-column: enrollments (more data, needs width) in the main area, profile in the sidebar.

**Files:**
- Modify: `app/(admin)/admin/students/[id]/page.tsx`

- [ ] **Step 1: Replace the return body**

The current return body in `StudentDetailPage` is the entire JSX from `<div className="p-6 max-w-5xl space-y-6">` to its closing `</div>`. Replace it with:

```tsx
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        breadcrumbs={[
          { label: 'Students', href: '/admin/students' },
          { label: `${student.firstName} ${student.lastName}` },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Enrollments — main area */}
        <div className="lg:col-span-2 space-y-3">
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

        {/* Profile — sidebar */}
        <div className="border rounded-lg p-4 space-y-3 self-start">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Profile
          </h2>
          <dl className="space-y-3 text-sm">
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
      </div>
    </div>
  )
```

The imports at the top of the file do not change — `cn`, `getStudentById`, `PageHeader`, `notFound`, and `dateFormatter` are all already present.

- [ ] **Step 2: Verify**

```bash
pnpm lint && pnpm build
```

Expected: exits 0, no type or lint errors.

- [ ] **Step 3: Commit**

```powershell
git add "app/(admin)/admin/students/[id]/page.tsx"
git commit -m "feat(admin): reorganize student detail to two-column layout"
```
