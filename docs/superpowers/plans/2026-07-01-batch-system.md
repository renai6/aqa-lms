# Batch System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-course batch system that groups enrolled students and provides batch-specific materialUrl/recordingUrl per lesson, starting at Batch 34.

**Architecture:** Two-phase schema migration - first add Batch/BatchLessonContent models and nullable batchId on Enrollment (non-breaking), run the Batch 34 data migration to move existing lesson URLs and assign all existing enrollments, then remove materialUrl/recordingUrl from Lesson. Student lesson content is served via BatchLessonContent keyed to the student's enrollment batchId. Admin UI lets admins start new batches and edit per-lesson URLs per batch.

**Tech Stack:** Next.js 16 App Router, Prisma 7 / PostgreSQL, PrismaPg adapter, React 19 server actions (useActionState), Vitest, Tailwind CSS 4, shadcn/ui

---

## File Map

**New files:**
- `prisma/migrate-batch-34.ts` - one-time data migration script
- `lib/batches/number.ts` - pure nextBatchNumber helper (testable)
- `lib/batches/queries.ts` - read functions (getActiveBatch, getCourseBatches, getBatchDetail)
- `lib/batches/actions.ts` - server actions (startNewBatchAction, upsertBatchLessonContentAction)
- `lib/__tests__/batches/number.test.ts` - unit tests for number helper
- `app/(admin)/admin/courses/[id]/start-batch-button.tsx` - client component with confirmation
- `app/(admin)/admin/courses/[id]/batches/page.tsx` - batch list page
- `app/(admin)/admin/courses/[id]/batches/[bid]/page.tsx` - batch management page
- `app/(admin)/admin/courses/[id]/batches/[bid]/batch-lesson-form.tsx` - inline edit per lesson

**Modified files:**
- `prisma/schema.prisma` - add Batch, BatchLessonContent, batchId on Enrollment, then remove Lesson URLs
- `lib/courses/queries.ts` - remove materialUrl/recordingUrl from LessonRow, LessonDetail, queries
- `lib/student/queries.ts` - load BatchLessonContent per student's batch in getStudentSubject
- `app/(admin)/admin/courses/[id]/subjects/[sid]/actions.ts` - remove URL fields from lesson schema and actions
- `app/(admin)/admin/courses/[id]/subjects/[sid]/lessons/new/create-lesson-form.tsx` - remove URL fields
- `app/(admin)/admin/courses/[id]/subjects/[sid]/lessons/[lid]/edit-lesson-form.tsx` - remove URL fields
- `app/(admin)/admin/courses/[id]/page.tsx` - add batch badge + start new batch button
- `app/(admin)/admin/purchases/[id]/actions.ts` - assign batchId when creating enrollment

---

## Task 1: Schema Phase 1 - Add batch models (non-breaking)

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Batch and BatchLessonContent models to schema.prisma**

In `prisma/schema.prisma`, add the following two new models after the `SubjectSchedule` model and before the `Lesson` model:

```prisma
model Batch {
  id       String  @id @default(cuid())
  courseId String
  course   Course  @relation(fields: [courseId], references: [id], onDelete: Cascade)
  number   Int
  isActive Boolean @default(false)

  createdAt DateTime @default(now())

  enrollments   Enrollment[]
  lessonContent BatchLessonContent[]

  @@unique([courseId, number])
  @@index([courseId])
}

model BatchLessonContent {
  id       String @id @default(cuid())
  batchId  String
  batch    Batch  @relation(fields: [batchId], references: [id], onDelete: Cascade)
  lessonId String
  lesson   Lesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  materialUrl  String?
  recordingUrl String?

  @@unique([batchId, lessonId])
}
```

- [ ] **Step 2: Add relations to Course, Enrollment, and Lesson**

In the `Course` model, add after the `purchaseItems PurchaseItem[]` line:
```prisma
  batches       Batch[]
```

In the `Enrollment` model, add after the `purchaseId String?` and `purchase Purchase?` lines:
```prisma
  batchId String?
  batch   Batch?  @relation(fields: [batchId], references: [id])
```

In the `Lesson` model, add after the `completions LessonCompletion[]` line:
```prisma
  batchContent BatchLessonContent[]
```

- [ ] **Step 3: Run the migration**

```bash
pnpm prisma migrate dev --name add-batch-models
```

Expected: Migration runs successfully, new tables `Batch` and `BatchLessonContent` created, `batchId` column added to `Enrollment`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add Batch and BatchLessonContent schema models"
```

---

## Task 2: Data migration - seed Batch 34

**Files:**
- Create: `prisma/migrate-batch-34.ts`

- [ ] **Step 1: Create the migration script**

Create `prisma/migrate-batch-34.ts`:

```typescript
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DIRECT_URL
if (!connectionString) throw new Error('DIRECT_URL environment variable is not set')

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

async function main() {
  const courses = await db.course.findMany({
    where: { enrollments: { some: {} } },
    select: {
      id: true,
      subjects: {
        select: {
          lessons: {
            select: { id: true, materialUrl: true, recordingUrl: true },
          },
        },
      },
    },
  })

  console.log(`Found ${courses.length} courses with enrollments.`)

  for (const course of courses) {
    const batch = await db.batch.upsert({
      where: { courseId_number: { courseId: course.id, number: 34 } },
      create: { courseId: course.id, number: 34, isActive: true },
      update: { isActive: true },
    })
    console.log(`Batch 34 ready for course ${course.id} (batchId: ${batch.id})`)

    const lessons = course.subjects.flatMap(s => s.lessons)
    for (const lesson of lessons) {
      if (lesson.materialUrl || lesson.recordingUrl) {
        await db.batchLessonContent.upsert({
          where: { batchId_lessonId: { batchId: batch.id, lessonId: lesson.id } },
          create: {
            batchId: batch.id,
            lessonId: lesson.id,
            materialUrl: lesson.materialUrl,
            recordingUrl: lesson.recordingUrl,
          },
          update: {
            materialUrl: lesson.materialUrl,
            recordingUrl: lesson.recordingUrl,
          },
        })
      }
    }
    console.log(`Migrated ${lessons.length} lessons for batch ${batch.id}`)

    const updated = await db.enrollment.updateMany({
      where: { courseId: course.id, batchId: null },
      data: { batchId: batch.id },
    })
    console.log(`Assigned ${updated.count} enrollments to Batch 34`)
  }

  console.log('Migration complete.')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
```

- [ ] **Step 2: Run the migration script**

```bash
npx tsx prisma/migrate-batch-34.ts
```

Expected output: Lines showing courses processed, lessons migrated, enrollments assigned. No errors.

- [ ] **Step 3: Verify in Prisma Studio**

```bash
pnpm prisma studio
```

Check that:
- `Batch` table has a row per course (number = 34, isActive = true)
- `BatchLessonContent` rows exist for lessons that had materialUrl or recordingUrl
- `Enrollment` rows have batchId populated

- [ ] **Step 4: Commit**

```bash
git add prisma/migrate-batch-34.ts
git commit -m "feat: add Batch 34 data migration script"
```

---

## Task 3: Schema Phase 2 - Remove lesson URL fields and update dependent code

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `lib/courses/queries.ts`
- Modify: `app/(admin)/admin/courses/[id]/subjects/[sid]/actions.ts`
- Modify: `app/(admin)/admin/courses/[id]/subjects/[sid]/lessons/new/create-lesson-form.tsx`
- Modify: `app/(admin)/admin/courses/[id]/subjects/[sid]/lessons/[lid]/edit-lesson-form.tsx`

- [ ] **Step 1: Remove materialUrl and recordingUrl from Lesson in schema.prisma**

In the `Lesson` model, delete these two lines:
```prisma
  materialUrl  String?
  recordingUrl String?
```

- [ ] **Step 2: Run the schema migration**

```bash
pnpm prisma migrate dev --name remove-lesson-url-fields
```

Expected: Migration runs, columns dropped from `Lesson` table.

- [ ] **Step 3: Update LessonRow and LessonDetail types in lib/courses/queries.ts**

Remove `materialUrl` and `recordingUrl` from `LessonRow`:
```typescript
export type LessonRow = {
  id: string
  title: string
  description: string | null
  order: number
}
```

Remove `materialUrl` and `recordingUrl` from `LessonDetail`:
```typescript
export type LessonDetail = {
  id: string
  subjectId: string
  title: string
  description: string | null
  order: number
  updatedAt: Date
  subject: { id: string; title: string; courseId: string; course: { title: string } }
}
```

In `getSubjectById`, remove `materialUrl: true` and `recordingUrl: true` from the lessons select block:
```typescript
lessons: {
  orderBy: { order: 'asc' },
  select: {
    id: true,
    title: true,
    description: true,
    order: true,
  },
},
```

In `getLessonById`, remove `materialUrl: true` and `recordingUrl: true` from the select block:
```typescript
return db.lesson.findUnique({
  where: { id: lid },
  select: {
    id: true,
    subjectId: true,
    title: true,
    description: true,
    order: true,
    updatedAt: true,
    subject: {
      select: {
        id: true,
        title: true,
        courseId: true,
        course: {
          select: { title: true },
        },
      },
    },
  },
})
```

- [ ] **Step 4: Update lesson schema and actions in app/(admin)/admin/courses/[id]/subjects/[sid]/actions.ts**

Replace the `lessonSchema` with one that has no URL fields:
```typescript
const lessonSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  description: z.string().optional(),
  order: z.coerce.number().int().min(1, 'Order must be at least 1.'),
})
```

In `createLessonAction`, update `raw` to remove URL fields:
```typescript
const raw = {
  title: formData.get('title'),
  description: formData.get('description'),
  order: formData.get('order') ?? '1',
}
```

Update the destructure and `db.lesson.create` call:
```typescript
const { title, description, order } = result.data

await db.lesson.create({
  data: {
    subjectId,
    title,
    description: description || null,
    order,
  },
})
```

In `updateLessonAction`, update `raw` the same way:
```typescript
const raw = {
  title: formData.get('title'),
  description: formData.get('description'),
  order: formData.get('order') ?? '1',
}
```

Update the destructure and `db.lesson.update` call:
```typescript
const { title, description, order } = result.data

await db.lesson.update({
  where: { id },
  data: {
    title,
    description: description || null,
    order,
  },
})
```

- [ ] **Step 5: Remove URL fields from create-lesson-form.tsx**

In `app/(admin)/admin/courses/[id]/subjects/[sid]/lessons/new/create-lesson-form.tsx`, delete the entire grid div that contains the Material URL and Recording URL inputs (the second `<div className="grid ...">` block at the bottom of the form, just before the error state).

The form should end with:
```tsx
<div className="space-y-2">
  <Label htmlFor="lesson-description">Description</Label>
  <Textarea id="lesson-description" name="description" rows={2} placeholder="Brief description..." />
</div>
{state.error && <p className="text-sm text-destructive">{state.error}</p>}
<Button type="submit" disabled={isPending}>
  {isPending ? 'Creating...' : 'Create Lesson'}
</Button>
```

- [ ] **Step 6: Remove URL fields from edit-lesson-form.tsx**

In `app/(admin)/admin/courses/[id]/subjects/[sid]/lessons/[lid]/edit-lesson-form.tsx`, delete both URL field divs:
```tsx
// Delete these two blocks:
<div className="space-y-2">
  <Label htmlFor="lesson-material">Material URL</Label>
  <Input id="lesson-material" name="materialUrl" type="text" placeholder="Google Drive link..." defaultValue={lesson.materialUrl ?? ''} />
</div>
<div className="space-y-2">
  <Label htmlFor="lesson-recording">Recording URL</Label>
  <Input id="lesson-recording" name="recordingUrl" type="text" placeholder="Google Drive link..." defaultValue={lesson.recordingUrl ?? ''} />
</div>
```

- [ ] **Step 7: Verify no type errors**

```bash
pnpm build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/courses/queries.ts "app/(admin)/admin/courses/[id]/subjects/[sid]/actions.ts" "app/(admin)/admin/courses/[id]/subjects/[sid]/lessons/new/create-lesson-form.tsx" "app/(admin)/admin/courses/[id]/subjects/[sid]/lessons/[lid]/edit-lesson-form.tsx"
git commit -m "feat: remove lesson-level URL fields; content is now batch-specific"
```

---

## Task 4: Batch lib - pure helper, queries, and server actions

**Files:**
- Create: `lib/batches/number.ts`
- Create: `lib/__tests__/batches/number.test.ts`
- Create: `lib/batches/queries.ts`
- Create: `lib/batches/actions.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/batches/number.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { nextBatchNumber } from '@/lib/batches/number'

describe('nextBatchNumber', () => {
  it('returns 34 when no batches exist for a course', () => {
    expect(nextBatchNumber(null)).toBe(34)
  })

  it('returns max + 1 when batches exist', () => {
    expect(nextBatchNumber(34)).toBe(35)
    expect(nextBatchNumber(37)).toBe(38)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test lib/__tests__/batches/number.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/batches/number'`

- [ ] **Step 3: Create lib/batches/number.ts**

```typescript
export function nextBatchNumber(maxExisting: number | null): number {
  return (maxExisting ?? 33) + 1
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
pnpm test lib/__tests__/batches/number.test.ts
```

Expected: PASS — 2 tests passing.

- [ ] **Step 5: Create lib/batches/queries.ts**

```typescript
import { db } from '@/lib/db'
import { nextBatchNumber } from './number'

export type BatchRow = {
  id: string
  number: number
  isActive: boolean
  createdAt: Date
  _count: { enrollments: number }
}

export async function getActiveBatch(courseId: string): Promise<{ id: string; number: number } | null> {
  return db.batch.findFirst({
    where: { courseId, isActive: true },
    select: { id: true, number: true },
  })
}

export async function getCourseBatches(courseId: string): Promise<BatchRow[]> {
  return db.batch.findMany({
    where: { courseId },
    orderBy: { number: 'desc' },
    select: {
      id: true,
      number: true,
      isActive: true,
      createdAt: true,
      _count: { select: { enrollments: true } },
    },
  })
}

export type BatchLesson = {
  id: string
  title: string
  order: number
  batchContent: Array<{ materialUrl: string | null; recordingUrl: string | null }>
}

export type BatchSubject = {
  id: string
  title: string
  order: number
  lessons: BatchLesson[]
}

export type BatchDetail = {
  id: string
  number: number
  isActive: boolean
  courseId: string
  _count: { enrollments: number }
  course: { subjects: BatchSubject[] }
}

export async function getBatchDetail(batchId: string): Promise<BatchDetail | null> {
  return db.batch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      number: true,
      isActive: true,
      courseId: true,
      _count: { select: { enrollments: true } },
      course: {
        select: {
          subjects: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              title: true,
              order: true,
              lessons: {
                orderBy: { order: 'asc' },
                select: {
                  id: true,
                  title: true,
                  order: true,
                  batchContent: {
                    where: { batchId },
                    select: { materialUrl: true, recordingUrl: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
}

export async function getMaxBatchNumber(courseId: string): Promise<number | null> {
  const result = await db.batch.aggregate({
    where: { courseId },
    _max: { number: true },
  })
  return result._max.number
}

export { nextBatchNumber }
```

- [ ] **Step 6: Create lib/batches/actions.ts**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { getMaxBatchNumber, nextBatchNumber } from './queries'

type ActionState = { error: string | null; success?: boolean }

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { ok: false as const, error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    return { ok: false as const, error: 'Forbidden' }
  }
  return { ok: true as const }
}

export async function startNewBatchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const courseId = formData.get('courseId')
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course ID.' }

  const auth = await requireAdmin()
  if (!auth.ok) return { error: auth.error }

  try {
    const maxNumber = await getMaxBatchNumber(courseId)
    const newNumber = nextBatchNumber(maxNumber)
    await db.$transaction(async (tx) => {
      await tx.batch.updateMany({
        where: { courseId, isActive: true },
        data: { isActive: false },
      })
      await tx.batch.create({
        data: { courseId, number: newNumber, isActive: true },
      })
    })
  } catch (err) {
    console.error('[startNewBatch]', err)
    return { error: 'A database error occurred.' }
  }

  revalidatePath('/admin/courses/' + courseId)
  revalidatePath('/admin/courses/' + courseId + '/batches')
  return { error: null, success: true }
}

export async function upsertBatchLessonContentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const batchId = formData.get('batchId')
  const lessonId = formData.get('lessonId')
  const courseId = formData.get('courseId')
  if (typeof batchId !== 'string' || !batchId) return { error: 'Invalid batch ID.' }
  if (typeof lessonId !== 'string' || !lessonId) return { error: 'Invalid lesson ID.' }
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course ID.' }

  const auth = await requireAdmin()
  if (!auth.ok) return { error: auth.error }

  const schema = z.object({
    materialUrl: z.string().optional(),
    recordingUrl: z.string().optional(),
  })
  const result = schema.safeParse({
    materialUrl: formData.get('materialUrl'),
    recordingUrl: formData.get('recordingUrl'),
  })
  if (!result.success) return { error: result.error.issues[0]?.message ?? 'Validation failed.' }

  try {
    await db.batchLessonContent.upsert({
      where: { batchId_lessonId: { batchId, lessonId } },
      create: {
        batchId,
        lessonId,
        materialUrl: result.data.materialUrl || null,
        recordingUrl: result.data.recordingUrl || null,
      },
      update: {
        materialUrl: result.data.materialUrl || null,
        recordingUrl: result.data.recordingUrl || null,
      },
    })
  } catch (err) {
    console.error('[upsertBatchLessonContent]', err)
    return { error: 'A database error occurred.' }
  }

  revalidatePath('/admin/courses/' + courseId + '/batches/' + batchId)
  return { error: null, success: true }
}
```

- [ ] **Step 7: Commit**

```bash
git add lib/batches/ lib/__tests__/batches/
git commit -m "feat: add batch lib (number helper, queries, server actions)"
```

---

## Task 5: Hook batch assignment into enrollment approval

**Files:**
- Modify: `app/(admin)/admin/purchases/[id]/actions.ts`

- [ ] **Step 1: Update approvePurchaseAction to assign batchId on enrollment creation**

In `app/(admin)/admin/purchases/[id]/actions.ts`, inside the transaction in `approvePurchaseAction`, replace the `tx.enrollment.create` call (lines 76-83) with:

```typescript
const activeBatch = await tx.batch.findFirst({
  where: { courseId: item.courseId, isActive: true },
  select: { id: true },
})
await tx.enrollment.create({
  data: {
    userId: purchase.user.id,
    courseId: item.courseId,
    paymentStatus,
    purchaseId: id,
    batchId: activeBatch?.id ?? null,
  },
})
```

- [ ] **Step 2: Verify no type errors**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/purchases/[id]/actions.ts"
git commit -m "feat: assign active batch to enrollment on purchase approval"
```

---

## Task 6: Update student subject query to serve batch-specific content

**Files:**
- Modify: `lib/student/queries.ts`

- [ ] **Step 1: Update StudentLesson type**

In `lib/student/queries.ts`, the `StudentLesson` type already has `materialUrl` and `recordingUrl` - these are now sourced from `BatchLessonContent`. The type signature stays the same; only the query changes.

- [ ] **Step 2: Update getStudentSubject to load BatchLessonContent**

Replace the entire `getStudentSubject` function with:

```typescript
export async function getStudentSubject(
  userId: string,
  subjectId: string,
): Promise<StudentSubject | null> {
  const subject = await db.subject.findUnique({
    where: { id: subjectId },
    select: {
      id: true,
      courseId: true,
      title: true,
      description: true,
      course: { select: { title: true } },
      schedules: { select: { day: true, startTime: true, endTime: true } },
      lessons: {
        orderBy: { order: 'asc' },
        select: { id: true, title: true, description: true, order: true },
      },
      assessments: {
        select: {
          id: true,
          title: true,
          type: true,
          durationMins: true,
          maxAttempts: true,
          attempts: {
            where: { userId },
            select: { score: true },
          },
        },
      },
    },
  })
  if (!subject) return null

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: subject.courseId } },
    select: { id: true, batchId: true },
  })
  if (!enrollment) return null

  const lessonIds = subject.lessons.map(l => l.id)

  const [completions, batchContents] = await Promise.all([
    lessonIds.length > 0
      ? db.lessonCompletion.findMany({
          where: { userId, lessonId: { in: lessonIds } },
          select: { lessonId: true },
        })
      : Promise.resolve([]),
    enrollment.batchId && lessonIds.length > 0
      ? db.batchLessonContent.findMany({
          where: { batchId: enrollment.batchId, lessonId: { in: lessonIds } },
          select: { lessonId: true, materialUrl: true, recordingUrl: true },
        })
      : Promise.resolve([]),
  ])

  const completedSet = new Set(completions.map(c => c.lessonId))
  const batchContentMap = new Map(batchContents.map(bc => [bc.lessonId, bc]))

  return {
    id: subject.id,
    courseId: subject.courseId,
    title: subject.title,
    description: subject.description,
    course: subject.course,
    schedules: subject.schedules,
    lessons: subject.lessons.map(l => {
      const content = batchContentMap.get(l.id)
      return {
        ...l,
        materialUrl: content?.materialUrl ?? null,
        recordingUrl: content?.recordingUrl ?? null,
        isCompleted: completedSet.has(l.id),
      }
    }),
    assessments: subject.assessments.map(a => {
      const scored = a.attempts.filter(att => att.score !== null)
      const bestScore = scored.length > 0 ? Math.max(...scored.map(att => att.score!)) : null
      return {
        id: a.id,
        title: a.title,
        type: a.type,
        durationMins: a.durationMins,
        maxAttempts: a.maxAttempts,
        bestScore,
        attemptCount: a.attempts.length,
      }
    }),
  }
}
```

- [ ] **Step 3: Verify no type errors**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add lib/student/queries.ts
git commit -m "feat: serve batch-specific lesson content to students"
```

---

## Task 7: Admin UI - Course detail page batch badge and start new batch button

**Files:**
- Create: `app/(admin)/admin/courses/[id]/start-batch-button.tsx`
- Modify: `app/(admin)/admin/courses/[id]/page.tsx`

- [ ] **Step 1: Create start-batch-button.tsx**

Create `app/(admin)/admin/courses/[id]/start-batch-button.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { startNewBatchAction } from '@/lib/batches/actions'
import { Button } from '@/components/ui/button'

type Props = { courseId: string }

export function StartBatchButton({ courseId }: Props) {
  const [state, action, isPending] = useActionState(startNewBatchAction, { error: null })

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      'Start a new batch? New enrollments will be assigned to it. Existing students stay in their current batch.'
    )
    if (!confirmed) e.preventDefault()
  }

  return (
    <form action={action} onSubmit={handleSubmit}>
      <input type="hidden" name="courseId" value={courseId} />
      {state.error && <p className="text-xs text-destructive mb-1">{state.error}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? 'Starting…' : 'Start New Batch'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Update app/(admin)/admin/courses/[id]/page.tsx**

Add these imports at the top of the file:
```tsx
import { getActiveBatch } from '@/lib/batches/queries'
import { StartBatchButton } from './start-batch-button'
```

Inside `CourseDetailPage`, after `const course = await getCourseById(id)`, add:
```tsx
const activeBatch = await getActiveBatch(course.id)
```

In the right column `<div className="space-y-4">`, add this card after the `<CourseImageCard .../>` and before the danger zone card:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center justify-between text-sm">
      Batches
      {activeBatch
        ? <Badge variant="outline">Batch {activeBatch.number}</Badge>
        : <Badge variant="destructive" className="text-xs">No Active Batch</Badge>
      }
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-2">
    {!activeBatch && (
      <p className="text-xs text-destructive">
        New enrollments will have no batch until you start one.
      </p>
    )}
    <div className="flex flex-wrap gap-2">
      <StartBatchButton courseId={course.id} />
      <Button asChild variant="ghost" size="sm">
        <Link href={'/admin/courses/' + course.id + '/batches'}>View all batches</Link>
      </Button>
    </div>
  </CardContent>
</Card>
```

- [ ] **Step 3: Run dev server and verify**

```bash
pnpm dev
```

Navigate to `/admin/courses/[any-course-id]`. Confirm:
- "Batches" card is visible in the right column
- Active batch badge shows "Batch 34" (or "No Active Batch" for courses with no enrollments)
- "Start New Batch" button triggers a confirmation dialog and, when confirmed, updates the badge

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/admin/courses/[id]/start-batch-button.tsx" "app/(admin)/admin/courses/[id]/page.tsx"
git commit -m "feat: add batch badge and start new batch button to course detail page"
```

---

## Task 8: Admin UI - Batch list page

**Files:**
- Create: `app/(admin)/admin/courses/[id]/batches/page.tsx`

- [ ] **Step 1: Create the batch list page**

Create `app/(admin)/admin/courses/[id]/batches/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getCourseById } from '@/lib/courses/queries'
import { getCourseBatches } from '@/lib/batches/queries'
import { getSession } from '@/lib/auth/session'
import { PageHeader } from '@/components/admin/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const course = await getCourseById(id)
  return { title: course ? 'Batches - ' + course.title + ' — AQA Admin' : 'Batches — AQA Admin' }
}

export default async function BatchesPage({ params }: Props) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const [course, batches] = await Promise.all([getCourseById(id), getCourseBatches(id)])
  if (!course) notFound()

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Courses', href: '/admin/courses' },
          { label: course.title, href: '/admin/courses/' + id },
          { label: 'Batches' },
        ]}
        title="Batches"
      />

      {batches.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
          No batches yet. Start one from the course page.
        </p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Batch</th>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Students</th>
                <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th scope="col" aria-label="Actions" className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {batches.map((batch) => (
                <tr key={batch.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 font-medium">Batch {batch.number}</td>
                  <td className="px-4 py-3">{batch._count.enrollments}</td>
                  <td className="px-4 py-3">
                    {batch.isActive
                      ? <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>
                      : <Badge variant="outline">Inactive</Badge>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={'/admin/courses/' + id + '/batches/' + batch.id}>
                        Manage <ChevronRight className="w-3 h-3 ml-1" aria-hidden="true" />
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

- [ ] **Step 2: Verify in browser**

With `pnpm dev` running, navigate to `/admin/courses/[any-course-id]/batches`. Confirm the batch table renders with Batch 34 listed as Active.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/courses/[id]/batches/page.tsx"
git commit -m "feat: add batch list page for course admin"
```

---

## Task 9: Admin UI - Batch management page with inline lesson URL editing

**Files:**
- Create: `app/(admin)/admin/courses/[id]/batches/[bid]/batch-lesson-form.tsx`
- Create: `app/(admin)/admin/courses/[id]/batches/[bid]/page.tsx`

- [ ] **Step 1: Create batch-lesson-form.tsx**

Create `app/(admin)/admin/courses/[id]/batches/[bid]/batch-lesson-form.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { upsertBatchLessonContentAction } from '@/lib/batches/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

type Props = {
  batchId: string
  courseId: string
  lessonId: string
  lessonTitle: string
  lessonOrder: number
  materialUrl: string | null
  recordingUrl: string | null
}

export function BatchLessonForm({
  batchId,
  courseId,
  lessonId,
  lessonTitle,
  lessonOrder,
  materialUrl,
  recordingUrl,
}: Props) {
  const [state, action, isPending] = useActionState(upsertBatchLessonContentAction, { error: null })

  return (
    <div className="py-3 border-b last:border-b-0 space-y-2">
      <p className="text-sm font-medium">
        <span className="text-muted-foreground mr-2">{lessonOrder}.</span>
        {lessonTitle}
      </p>
      <form action={action} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <input type="hidden" name="batchId" value={batchId} />
        <input type="hidden" name="lessonId" value={lessonId} />
        <input type="hidden" name="courseId" value={courseId} />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Material URL</Label>
          <Input
            name="materialUrl"
            defaultValue={materialUrl ?? ''}
            placeholder="Google Drive link…"
            className="text-sm h-8"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Recording URL</Label>
          <Input
            name="recordingUrl"
            defaultValue={recordingUrl ?? ''}
            placeholder="Google Drive link…"
            className="text-sm h-8"
          />
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button type="submit" size="sm" disabled={isPending} className="h-8">
            {isPending ? 'Saving…' : 'Save'}
          </Button>
          {state.success && !state.error && (
            <span className="text-xs text-green-600">Saved</span>
          )}
          {state.error && (
            <span className="text-xs text-destructive">{state.error}</span>
          )}
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Create the batch management page**

Create `app/(admin)/admin/courses/[id]/batches/[bid]/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation'
import { getBatchDetail } from '@/lib/batches/queries'
import { getCourseById } from '@/lib/courses/queries'
import { getSession } from '@/lib/auth/session'
import { PageHeader } from '@/components/admin/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BatchLessonForm } from './batch-lesson-form'

type Props = { params: Promise<{ id: string; bid: string }> }

export async function generateMetadata({ params }: Props) {
  const { bid } = await params
  const batch = await getBatchDetail(bid)
  return { title: batch ? 'Batch ' + batch.number + ' — AQA Admin' : 'Batch — AQA Admin' }
}

export default async function BatchDetailPage({ params }: Props) {
  const { id, bid } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const [course, batch] = await Promise.all([getCourseById(id), getBatchDetail(bid)])
  if (!course || !batch || batch.courseId !== id) notFound()

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Courses', href: '/admin/courses' },
          { label: course.title, href: '/admin/courses/' + id },
          { label: 'Batches', href: '/admin/courses/' + id + '/batches' },
          { label: 'Batch ' + batch.number },
        ]}
        title={'Batch ' + batch.number}
        action={
          batch.isActive
            ? <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>
            : <Badge variant="outline">Inactive</Badge>
        }
      />

      <p className="text-sm text-muted-foreground">
        {batch._count.enrollments} student{batch._count.enrollments !== 1 ? 's' : ''} enrolled in this batch
      </p>

      <div className="space-y-4">
        {batch.course.subjects.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8 border rounded-lg">
            No subjects in this course yet.
          </p>
        )}
        {batch.course.subjects.map((subject) => (
          <Card key={subject.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{subject.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {subject.lessons.length === 0 ? (
                <p className="text-sm text-muted-foreground">No lessons in this subject.</p>
              ) : (
                <div>
                  {subject.lessons.map((lesson) => {
                    const content = lesson.batchContent[0] ?? null
                    return (
                      <BatchLessonForm
                        key={lesson.id}
                        batchId={bid}
                        courseId={id}
                        lessonId={lesson.id}
                        lessonTitle={lesson.title}
                        lessonOrder={lesson.order}
                        materialUrl={content?.materialUrl ?? null}
                        recordingUrl={content?.recordingUrl ?? null}
                      />
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

With `pnpm dev` running, navigate to `/admin/courses/[id]/batches/[bid]`. Confirm:
- Lessons are grouped by subject
- Each lesson shows material/recording URL fields pre-populated from Batch 34 data
- Clicking "Save" on a lesson shows "Saved" confirmation
- Navigating back to the page shows the saved values

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/admin/courses/[id]/batches/[bid]/batch-lesson-form.tsx" "app/(admin)/admin/courses/[id]/batches/[bid]/page.tsx"
git commit -m "feat: add batch management page with inline lesson URL editing"
```

---

## Task 10: End-to-end verification

- [ ] **Step 1: Run full test suite**

```bash
pnpm test
```

Expected: All tests pass including the new batch number tests.

- [ ] **Step 2: Run production build**

```bash
pnpm build
```

Expected: No TypeScript errors, no build failures.

- [ ] **Step 3: Smoke test the full flow**

With `pnpm dev` running:

1. Log in as admin. Navigate to a course detail page. Confirm "Batch 34" badge appears.
2. Click "Start New Batch" and confirm. Badge should now show "Batch 35".
3. Navigate to `/admin/courses/[id]/batches`. Confirm both Batch 34 (Inactive) and Batch 35 (Active) appear.
4. Click "Manage" on Batch 35. Enter a material URL and recording URL for a lesson. Click Save. Confirm "Saved" appears.
5. Navigate to `/admin/purchases` and approve a new purchase. In Prisma Studio, confirm the new `Enrollment` has `batchId` pointing to Batch 35.
6. Log in as the student. Navigate to the subject page. Confirm the lesson shows the Batch 35 material/recording URL.
7. Log in as a student enrolled in Batch 34. Navigate to the same lesson. Confirm it shows the Batch 34 URLs (migrated from the original lesson data).

- [ ] **Step 4: Commit if any minor fixes were made during verification**

```bash
git add -p
git commit -m "fix: batch system smoke test fixes"
```
