# Course Meet Link & Duration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional `meetLink` (URL string) and `courseDuration` (SHORT | LONG enum) fields to the Course model, surfacing them in admin forms and the public course listing.

**Architecture:** Schema-first — add the Prisma enum and fields, migrate the DB, then propagate the types outward through queries → actions → forms → public UI. No new files needed; all changes are additive edits to existing files.

**Tech Stack:** Prisma 7, PostgreSQL (remote Supabase), Next.js 16 App Router, Zod 4, React 19, Tailwind CSS 4, shadcn/ui.

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `CourseDuration` enum + `meetLink`/`courseDuration` fields to `Course` |
| `lib/courses/queries.ts` | Add new fields to `CourseDetail`, `PublishedCourseRow`, `CourseRow` types and all select clauses |
| `app/(admin)/admin/courses/actions.ts` | Extend `courseSchema` + both create/update actions |
| `app/(admin)/admin/courses/new/create-course-form.tsx` | Add Meet link input + duration radios |
| `app/(admin)/admin/courses/[id]/edit-course-form.tsx` | Same additions, pre-populated from course data |
| `app/(public)/courses/page.tsx` | Duration badge + Meet link on course cards |

---

### Task 1: Schema — add enum and fields

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `CourseDuration` enum**

In `prisma/schema.prisma`, add the new enum alongside the existing `CourseType` enum (around line 79):

```prisma
enum CourseDuration {
  SHORT
  LONG
}
```

- [ ] **Step 2: Add fields to the `Course` model**

Inside the `Course` model (after `tuitionFee   Decimal?`, around line 153), add:

```prisma
  meetLink       String?
  courseDuration CourseDuration?
```

- [ ] **Step 3: Run migration**

```bash
pnpm prisma migrate dev --name add-meet-link-and-duration
```

Expected: migration file created, Prisma client regenerated, no errors.

- [ ] **Step 4: Verify client types**

```bash
node -e "const { CourseDuration } = require('@prisma/client'); console.log(CourseDuration)"
```

Expected output: `{ SHORT: 'SHORT', LONG: 'LONG' }`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add CourseDuration enum and meetLink/courseDuration fields to Course"
```

---

### Task 2: Data layer — extend query types and selects

**Files:**
- Modify: `lib/courses/queries.ts`

- [ ] **Step 1: Update `PublishedCourseRow` type**

Replace the current `PublishedCourseRow` type (lines 4–11):

```ts
import type { CourseType, CourseDuration, DayOfWeek } from '@prisma/client'

export type PublishedCourseRow = {
  id: string
  title: string
  description: string | null
  imageUrl: string | null
  tuitionFee: number | null
  courseType: CourseType
  meetLink: string | null
  courseDuration: CourseDuration | null
}
```

- [ ] **Step 2: Update `CourseRow` type**

Replace the current `CourseRow` type (lines 31–41):

```ts
export type CourseRow = {
  id: string
  title: string
  description: string | null
  imageUrl: string | null
  isPublished: boolean
  courseType: CourseType
  passingGrade: number
  meetLink: string | null
  courseDuration: CourseDuration | null
  createdAt: Date
  _count: { subjects: number }
}
```

- [ ] **Step 3: Update `CourseDetail` type**

Replace the current `CourseDetail` type (lines 52–64):

```ts
export type CourseDetail = {
  id: string
  title: string
  description: string | null
  imageUrl: string | null
  isPublished: boolean
  courseType: CourseType
  passingGrade: number
  tuitionFee: number | null
  meetLink: string | null
  courseDuration: CourseDuration | null
  createdAt: Date
  updatedAt: Date
  subjects: SubjectRow[]
}
```

- [ ] **Step 4: Update `getPublishedCourses` select**

In `getPublishedCourses` (around line 16), extend the `select` object:

```ts
select: {
  id: true,
  title: true,
  description: true,
  imageUrl: true,
  tuitionFee: true,
  courseType: true,
  meetLink: true,
  courseDuration: true,
},
```

Also update the `.map` to pass through the new fields:

```ts
return rows.map(r => ({
  ...r,
  tuitionFee: r.tuitionFee?.toNumber() ?? null,
}))
```

(The spread already covers the new fields since they are plain strings/enums — no conversion needed.)

- [ ] **Step 5: Update `getPublishedCourseById` select**

In `getPublishedCourseById` (around line 24), extend the `select` object:

```ts
select: {
  id: true,
  title: true,
  description: true,
  imageUrl: true,
  isPublished: true,
  tuitionFee: true,
  courseType: true,
  meetLink: true,
  courseDuration: true,
},
```

Also update the return statement to include the new fields:

```ts
return {
  id: course.id,
  title: course.title,
  description: course.description,
  imageUrl: course.imageUrl,
  tuitionFee: course.tuitionFee?.toNumber() ?? null,
  courseType: course.courseType,
  meetLink: course.meetLink,
  courseDuration: course.courseDuration,
}
```

- [ ] **Step 6: Update `getCourses` select**

In `getCourses` (around line 125), extend the `select` object:

```ts
select: {
  id: true,
  title: true,
  description: true,
  imageUrl: true,
  isPublished: true,
  courseType: true,
  passingGrade: true,
  meetLink: true,
  courseDuration: true,
  createdAt: true,
  _count: {
    select: { subjects: true },
  },
},
```

- [ ] **Step 7: Update `getCourseById` select**

In `getCourseById` (around line 144), extend the `select` object:

```ts
select: {
  id: true,
  title: true,
  description: true,
  imageUrl: true,
  isPublished: true,
  courseType: true,
  passingGrade: true,
  tuitionFee: true,
  meetLink: true,
  courseDuration: true,
  createdAt: true,
  updatedAt: true,
  subjects: {
    orderBy: { order: 'asc' },
    select: {
      id: true,
      title: true,
      description: true,
      order: true,
      units: true,
      _count: {
        select: { lessons: true },
      },
    },
  },
},
```

Also update the return to spread new fields (the existing spread `...raw` already handles it, but ensure `tuitionFee` conversion is still explicit):

```ts
return {
  ...raw,
  tuitionFee: raw.tuitionFee ? raw.tuitionFee.toNumber() : null,
}
```

- [ ] **Step 8: Verify TypeScript**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `lib/courses/queries.ts`.

- [ ] **Step 9: Commit**

```bash
git add lib/courses/queries.ts
git commit -m "feat: propagate meetLink and courseDuration through course query types"
```

---

### Task 3: Server actions — extend Zod schema and persistence

**Files:**
- Modify: `app/(admin)/admin/courses/actions.ts`

- [ ] **Step 1: Extend `courseSchema`**

Replace the current `courseSchema` definition (lines 28–37) with:

```ts
const courseSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  description: z.string().optional(),
  courseType: z.enum(['ON_SITE', 'ONLINE'], { error: 'Please select a course type.' }),
  passingGrade: z.coerce.number().min(0, 'Must be at least 0.').max(100, 'Must be at most 100.'),
  tuitionFee: z.preprocess(
    v => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number().min(0, 'Tuition fee cannot be negative.').optional(),
  ),
  meetLink: z.preprocess(
    v => (v === '' || v === null || v === undefined ? undefined : v),
    z.string().url('Meet link must be a valid URL.').optional(),
  ),
  courseDuration: z.preprocess(
    v => (v === '' || v === null || v === undefined ? undefined : v),
    z.enum(['SHORT', 'LONG']).optional(),
  ),
})
```

- [ ] **Step 2: Update `createCourseAction` — read and persist new fields**

In `createCourseAction`, update the `raw` object (around line 47) to include the new fields:

```ts
const raw = {
  title: formData.get('title'),
  description: formData.get('description'),
  courseType: formData.get('courseType'),
  passingGrade: formData.get('passingGrade') ?? '75',
  tuitionFee: formData.get('tuitionFee'),
  meetLink: formData.get('meetLink'),
  courseDuration: formData.get('courseDuration'),
}
```

Update the destructure (around line 60):

```ts
const { title, description, courseType, passingGrade, tuitionFee, meetLink, courseDuration } = result.data
```

Update the `db.course.create` call (around line 65):

```ts
newCourse = await db.course.create({
  data: {
    title,
    description: description || null,
    courseType: courseType as CourseType,
    passingGrade,
    tuitionFee: tuitionFee ?? null,
    meetLink: meetLink ?? null,
    courseDuration: courseDuration ?? null,
  },
  select: { id: true },
})
```

- [ ] **Step 3: Update `updateCourseAction` — read and persist new fields**

In `updateCourseAction`, update the `raw` object (around line 88):

```ts
const raw = {
  title: formData.get('title'),
  description: formData.get('description'),
  courseType: formData.get('courseType'),
  passingGrade: formData.get('passingGrade') ?? '75',
  tuitionFee: formData.get('tuitionFee'),
  meetLink: formData.get('meetLink'),
  courseDuration: formData.get('courseDuration'),
}
```

Update the destructure (around line 101):

```ts
const { title, description, courseType, passingGrade, tuitionFee, meetLink, courseDuration } = result.data
```

Update the `db.course.update` call (around line 104):

```ts
await db.course.update({
  where: { id },
  data: {
    title,
    description: description || null,
    courseType: courseType as CourseType,
    passingGrade,
    tuitionFee: tuitionFee ?? null,
    meetLink: meetLink ?? null,
    courseDuration: courseDuration ?? null,
  },
})
```

- [ ] **Step 4: Verify TypeScript**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/(admin)/admin/courses/actions.ts
git commit -m "feat: extend courseSchema and actions to persist meetLink and courseDuration"
```

---

### Task 4: Admin create form — add Meet link + duration fields

**Files:**
- Modify: `app/(admin)/admin/courses/new/create-course-form.tsx`

- [ ] **Step 1: Add Meet link input and duration radios**

Replace the full file contents:

```tsx
'use client'

import { useActionState } from 'react'
import { createCourseAction } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'

export function CreateCourseForm() {
  const [state, formAction, isPending] = useActionState(createCourseAction, { error: null })
  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title <span aria-hidden="true">*</span></Label>
            <Input id="title" name="title" required placeholder="e.g. Qur'an Recitation Basics" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" placeholder="Brief course description..." rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Course Type <span aria-hidden="true">*</span></Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="courseType" value="ON_SITE" defaultChecked className="accent-primary" />
                On-Site
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="courseType" value="ONLINE" className="accent-primary" />
                Online
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="meetLink">Google Meet Link</Label>
            <Input id="meetLink" name="meetLink" type="url" placeholder="https://meet.google.com/xxx-xxxx-xxx" />
            <p className="text-xs text-muted-foreground">Only applicable for Online courses.</p>
          </div>
          <div className="space-y-2">
            <Label>Course Duration</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="courseDuration" value="" defaultChecked className="accent-primary" />
                Not specified
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="courseDuration" value="SHORT" className="accent-primary" />
                Short
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="courseDuration" value="LONG" className="accent-primary" />
                Long
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="passingGrade">Passing Grade (%)</Label>
            <Input id="passingGrade" name="passingGrade" type="number" min="0" max="100" step="0.1" defaultValue="75" />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Creating...' : 'Create Course'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/courses/new/create-course-form.tsx"
git commit -m "feat: add meet link and duration fields to create course form"
```

---

### Task 5: Admin edit form — add Meet link + duration fields (pre-populated)

**Files:**
- Modify: `app/(admin)/admin/courses/[id]/edit-course-form.tsx`

- [ ] **Step 1: Add Meet link input and duration radios with pre-populated values**

Replace the full file contents:

```tsx
'use client'

import { useActionState } from 'react'
import { updateCourseAction } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CourseDetail } from '@/lib/courses/queries'

type Props = { course: CourseDetail }

export function EditCourseForm({ course }: Props) {
  const [state, formAction, isPending] = useActionState(updateCourseAction, { error: null })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Course Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={course.id} />
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" name="title" required defaultValue={course.title} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              name="description"
              rows={3}
              defaultValue={course.description ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label>Course Type</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="courseType" value="ON_SITE" defaultChecked={course.courseType === 'ON_SITE'} className="accent-primary" />
                On-Site
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="courseType" value="ONLINE" defaultChecked={course.courseType === 'ONLINE'} className="accent-primary" />
                Online
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-meetLink">Google Meet Link</Label>
            <Input
              id="edit-meetLink"
              name="meetLink"
              type="url"
              placeholder="https://meet.google.com/xxx-xxxx-xxx"
              defaultValue={course.meetLink ?? ''}
            />
            <p className="text-xs text-muted-foreground">Only applicable for Online courses.</p>
          </div>
          <div className="space-y-2">
            <Label>Course Duration</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="courseDuration" value="" defaultChecked={!course.courseDuration} className="accent-primary" />
                Not specified
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="courseDuration" value="SHORT" defaultChecked={course.courseDuration === 'SHORT'} className="accent-primary" />
                Short
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="courseDuration" value="LONG" defaultChecked={course.courseDuration === 'LONG'} className="accent-primary" />
                Long
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-passingGrade">Passing Grade (%)</Label>
            <Input
              id="edit-passingGrade"
              name="passingGrade"
              type="number"
              min="0"
              max="100"
              step="0.1"
              defaultValue={String(course.passingGrade)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-tuitionFee">Tuition Fee (₱)</Label>
            <Input
              id="edit-tuitionFee"
              name="tuitionFee"
              type="number"
              min="0"
              step="0.01"
              defaultValue={course.tuitionFee !== null ? String(course.tuitionFee) : ''}
              placeholder="e.g. 10000"
            />
            <p className="text-xs text-muted-foreground">Leave blank if not applicable.</p>
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state.success && !state.error && (
            <p className="text-sm text-green-600">Saved successfully.</p>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/courses/[id]/edit-course-form.tsx"
git commit -m "feat: add meet link and duration fields to edit course form"
```

---

### Task 6: Public course cards — duration badge + Meet link

**Files:**
- Modify: `app/(public)/courses/page.tsx`

- [ ] **Step 1: Add `CourseDuration` import**

At the top of the file, extend the existing import (line 4):

```ts
import type { CourseType, CourseDuration } from "@prisma/client";
```

- [ ] **Step 2: Add duration badge and Meet link to each course card**

Inside the course card's image section, after the existing type badge (around line 129), add the duration badge:

```tsx
{/* Duration badge */}
{course.courseDuration && (
  <span className="absolute top-2 left-16 text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-600 text-white">
    {course.courseDuration === 'SHORT' ? 'Short' : 'Long'}
  </span>
)}
```

Inside the card's content section, after the title/description block and before the tuition fee block (around line 154), add the Meet link:

```tsx
{course.meetLink && (
  <a
    href={course.meetLink}
    target="_blank"
    rel="noopener noreferrer"
    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
  >
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z"/>
    </svg>
    Join Google Meet
  </a>
)}
```

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Full lint check**

```bash
pnpm lint 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(public)/courses/page.tsx"
git commit -m "feat: show duration badge and meet link on public course cards"
```

---

### Task 7: Manual smoke test

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Test create form**

1. Log in as admin and navigate to `/admin/courses/new`.
2. Fill in a title, set Course Type to **Online**, enter a Meet link (e.g. `https://meet.google.com/abc-defg-hij`), set Duration to **Short**, and submit.
3. Confirm redirect to the new course detail page with no errors.

- [ ] **Step 3: Test edit form**

1. On the new course's detail page, open the edit form.
2. Verify the Meet link and Duration radio buttons are pre-populated correctly.
3. Change Duration to **Long**, save, and confirm "Saved successfully." message.

- [ ] **Step 4: Test public page**

1. Publish the course via the admin toggle.
2. Navigate to `/courses`.
3. Confirm the course card shows a **Long** duration badge and a **Join Google Meet** link.
4. Click the Meet link — confirm it opens in a new tab.

- [ ] **Step 5: Test empty state**

1. Create a second course with no Meet link and no Duration set.
2. Publish it and confirm its card on `/courses` shows **neither** a duration badge nor a Meet link.
