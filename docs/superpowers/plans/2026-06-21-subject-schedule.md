# Subject Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-subject scheduling (day of week + time range, multiple independent slots) managed by admins and visible to students.

**Architecture:** New `SubjectSchedule` table (one row per slot) with Cascade delete from `Subject`. Two server actions added to the existing `app/(admin)/admin/courses/[id]/actions.ts` (same file as teacher assignment). A new `SchedulePanel` client component renders in the subject detail sidebar, following the `TeacherAssignmentPanel` pattern exactly.

**Tech Stack:** Prisma 7, PostgreSQL, Next.js 16 App Router server actions, Zod 4, React 19 `useActionState`, shadcn/ui, Tailwind CSS 4.

---

## File Map

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Add `DayOfWeek` enum, `SubjectSchedule` model, `schedules` relation on `Subject` |
| `lib/courses/queries.ts` | Add `ScheduleRow` type, update `SubjectDetail`, update `getSubjectById` to include schedules |
| `app/(admin)/admin/courses/[id]/actions.ts` | Add `addScheduleAction` and `removeScheduleAction` |
| `app/(admin)/admin/courses/[id]/subjects/[sid]/schedule-panel.tsx` | New `SchedulePanel` client component |
| `app/(admin)/admin/courses/[id]/subjects/[sid]/page.tsx` | Import and render `SchedulePanel` in sidebar |

---

### Task 1: Schema — DayOfWeek enum and SubjectSchedule model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add DayOfWeek enum and SubjectSchedule model to schema**

In `prisma/schema.prisma`, add the enum directly after the existing enums block (after `TokenType`), and add the new model after the `SubjectTeacher` model. Also add `schedules SubjectSchedule[]` to the `Subject` model.

Add after the `TokenType` enum:
```prisma
enum DayOfWeek {
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
  SATURDAY
  SUNDAY
}
```

Add `schedules SubjectSchedule[]` to `Subject` (after the `teachers` line):
```prisma
  teachers    SubjectTeacher[]
  schedules   SubjectSchedule[]
```

Add after the `SubjectTeacher` model:
```prisma
model SubjectSchedule {
  id        String    @id @default(cuid())
  subjectId String
  subject   Subject   @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  day       DayOfWeek
  startTime String
  endTime   String

  @@index([subjectId])
}
```

- [ ] **Step 2: Run migration**

```bash
pnpm prisma migrate dev --name add-subject-schedule
```

Expected output includes: `The following migration(s) have been created and applied` and `✔ Generated Prisma Client`.

- [ ] **Step 3: Verify generated client has DayOfWeek**

```bash
pnpm prisma generate
```

Confirm `app/generated/prisma/enums.ts` now contains `DayOfWeek`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add SubjectSchedule model and DayOfWeek enum"
```

---

### Task 2: Queries — ScheduleRow type and include schedules in getSubjectById

**Files:**
- Modify: `lib/courses/queries.ts`

- [ ] **Step 1: Add DayOfWeek import and ScheduleRow type**

At the top of `lib/courses/queries.ts`, add the import:
```ts
import { DayOfWeek } from '@/app/generated/prisma'
```

After the `TeacherRow` type definition, add:
```ts
export type ScheduleRow = {
  id: string
  day: DayOfWeek
  startTime: string
  endTime: string
}
```

- [ ] **Step 2: Add schedules to SubjectDetail type**

Update the `SubjectDetail` type to include `schedules`:
```ts
export type SubjectDetail = {
  id: string
  courseId: string
  title: string
  description: string | null
  order: number
  units: number
  createdAt: Date
  updatedAt: Date
  course: { title: string }
  lessons: LessonRow[]
  teachers: TeacherRow[]
  schedules: ScheduleRow[]
}
```

- [ ] **Step 3: Include schedules in getSubjectById query**

In the `getSubjectById` function, add `schedules` to the `select` block (after `teachers`):
```ts
      schedules: {
        select: {
          id: true,
          day: true,
          startTime: true,
          endTime: true,
        },
      },
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm build 2>&1 | head -30
```

Expected: no type errors related to `ScheduleRow` or `SubjectDetail`. (Build may fail on other things — only check that the new types are clean.)

- [ ] **Step 5: Commit**

```bash
git add lib/courses/queries.ts
git commit -m "feat: add ScheduleRow type and include schedules in getSubjectById"
```

---

### Task 3: Server actions — addScheduleAction and removeScheduleAction

**Files:**
- Modify: `app/(admin)/admin/courses/[id]/actions.ts`

- [ ] **Step 1: Add DayOfWeek import**

At the top of `app/(admin)/admin/courses/[id]/actions.ts`, add:
```ts
import { DayOfWeek } from '@/app/generated/prisma'
```

- [ ] **Step 2: Add schedule Zod schema**

After the existing `subjectSchema` definition, add:
```ts
const ALL_DAYS = [
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
] as const

const scheduleSchema = z.object({
  day: z.enum(ALL_DAYS),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid start time format.'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid end time format.'),
})
```

- [ ] **Step 3: Add addScheduleAction**

After the `removeTeacherAction` function, add:
```ts
export async function addScheduleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  const subjectId = formData.get('subjectId')
  if (typeof subjectId !== 'string' || !subjectId) return { error: 'Invalid subject ID.' }

  const courseId = formData.get('courseId')
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course ID.' }

  const raw = {
    day: formData.get('day'),
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
  }

  const result = scheduleSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed.' }
  }

  const { day, startTime, endTime } = result.data
  if (startTime >= endTime) {
    return { error: 'Start time must be before end time.' }
  }

  try {
    await db.subjectSchedule.create({
      data: { subjectId, day: day as DayOfWeek, startTime, endTime },
    })
  } catch (err) {
    console.error('[addSchedule]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/courses/' + courseId + '/subjects/' + subjectId)
  return { error: null, success: true }
}
```

- [ ] **Step 4: Add removeScheduleAction**

After `addScheduleAction`, add:
```ts
export async function removeScheduleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  const scheduleId = formData.get('scheduleId')
  if (typeof scheduleId !== 'string' || !scheduleId) return { error: 'Invalid schedule ID.' }

  const subjectId = formData.get('subjectId')
  if (typeof subjectId !== 'string' || !subjectId) return { error: 'Invalid subject ID.' }

  const courseId = formData.get('courseId')
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course ID.' }

  try {
    await db.subjectSchedule.delete({ where: { id: scheduleId } })
  } catch (err) {
    console.error('[removeSchedule]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/courses/' + courseId + '/subjects/' + subjectId)
  return { error: null }
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
pnpm build 2>&1 | head -30
```

Expected: no type errors in the actions file.

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/admin/courses/[id]/actions.ts"
git commit -m "feat: add addScheduleAction and removeScheduleAction"
```

---

### Task 4: SchedulePanel component

**Files:**
- Create: `app/(admin)/admin/courses/[id]/subjects/[sid]/schedule-panel.tsx`

- [ ] **Step 1: Create the SchedulePanel component**

Create `app/(admin)/admin/courses/[id]/subjects/[sid]/schedule-panel.tsx` with this content:

```tsx
'use client'

import { useActionState } from 'react'
import { addScheduleAction, removeScheduleAction } from '../../actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ScheduleRow } from '@/lib/courses/queries'
import type { DayOfWeek } from '@/app/generated/prisma'

type Props = {
  subjectId: string
  courseId: string
  schedules: ScheduleRow[]
}

const ALL_DAYS: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]

const DAY_ORDER: Record<DayOfWeek, number> = {
  MONDAY: 0,
  TUESDAY: 1,
  WEDNESDAY: 2,
  THURSDAY: 3,
  FRIDAY: 4,
  SATURDAY: 5,
  SUNDAY: 6,
}

const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`
}

function sortedSchedules(schedules: ScheduleRow[]): ScheduleRow[] {
  return [...schedules].sort((a, b) => DAY_ORDER[a.day] - DAY_ORDER[b.day])
}

export function SchedulePanel({ subjectId, courseId, schedules }: Props) {
  const [addState, addFormAction, addPending] = useActionState(addScheduleAction, {
    error: null,
  })
  const [removeState, removeFormAction, removePending] = useActionState(removeScheduleAction, {
    error: null,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No schedule set.</p>
        ) : (
          <ul className="space-y-2">
            {sortedSchedules(schedules).map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span>
                  {DAY_LABELS[s.day]} {formatTime12h(s.startTime)} – {formatTime12h(s.endTime)}
                </span>
                <form action={removeFormAction}>
                  <input type="hidden" name="scheduleId" value={s.id} />
                  <input type="hidden" name="subjectId" value={subjectId} />
                  <input type="hidden" name="courseId" value={courseId} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    disabled={removePending}
                    className="text-destructive hover:text-destructive h-7 px-2"
                  >
                    Remove
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={addFormAction} className="space-y-3">
          <input type="hidden" name="subjectId" value={subjectId} />
          <input type="hidden" name="courseId" value={courseId} />
          <div className="space-y-1">
            <Label>Day</Label>
            <Select name="day" required>
              <SelectTrigger>
                <SelectValue placeholder="Select day..." />
              </SelectTrigger>
              <SelectContent>
                {ALL_DAYS.map((day) => (
                  <SelectItem key={day} value={day}>
                    {DAY_LABELS[day]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="sched-start">Start</Label>
              <input
                id="sched-start"
                name="startTime"
                type="time"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sched-end">End</Label>
              <input
                id="sched-end"
                name="endTime"
                type="time"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          {(addState.error || removeState.error) && (
            <p className="text-sm text-destructive">{addState.error ?? removeState.error}</p>
          )}
          <Button type="submit" variant="outline" className="w-full" disabled={addPending}>
            {addPending ? 'Adding...' : 'Add Slot'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(admin)/admin/courses/[id]/subjects/[sid]/schedule-panel.tsx"
git commit -m "feat: add SchedulePanel component for subject scheduling"
```

---

### Task 5: Wire SchedulePanel into subject detail page

**Files:**
- Modify: `app/(admin)/admin/courses/[id]/subjects/[sid]/page.tsx`

- [ ] **Step 1: Import SchedulePanel**

Add this import to `page.tsx` (after the `TeacherAssignmentPanel` import):
```ts
import { SchedulePanel } from './schedule-panel'
```

- [ ] **Step 2: Render SchedulePanel in the sidebar**

In the right sidebar `<div className="space-y-4">`, insert `SchedulePanel` between `TeacherAssignmentPanel` and `DeleteSubjectButton`:
```tsx
          <TeacherAssignmentPanel
            subjectId={sid}
            courseId={id}
            currentTeachers={subject.teachers}
            allTeachers={allTeachers}
          />
          <SchedulePanel
            subjectId={sid}
            courseId={id}
            schedules={subject.schedules}
          />
          <DeleteSubjectButton subjectId={sid} courseId={id} subjectTitle={subject.title} />
```

- [ ] **Step 3: Verify TypeScript compiles clean**

```bash
pnpm build 2>&1 | head -50
```

Expected: clean build with no type errors.

- [ ] **Step 4: Manual verification**

Start the dev server:
```bash
pnpm dev
```

1. Navigate to any subject detail page: `/admin/courses/<courseId>/subjects/<sid>`
2. Confirm "Schedule" card appears in the right sidebar below "Teachers"
3. Confirm "No schedule set." is shown initially
4. Add a slot: select "Thursday", set start to 19:00, end to 21:00 → click "Add Slot"
5. Confirm "Thursday 7:00 PM – 9:00 PM" appears in the list
6. Add another slot: "Friday", 19:00–21:00 → confirm it appears below Thursday
7. Click "Remove" on one slot → confirm it disappears
8. Add a slot where start >= end → confirm error "Start time must be before end time."

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/admin/courses/[id]/subjects/[sid]/page.tsx"
git commit -m "feat: wire SchedulePanel into subject detail page"
```
