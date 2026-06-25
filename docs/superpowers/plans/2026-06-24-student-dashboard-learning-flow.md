# Student Dashboard & Learning Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the student learning portal: redesigned dashboard (courses, schedules, announcements, payment), a course page (subjects + progress), and a subject page (lessons with Done toggle + assessments list).

**Architecture:** Three new routes under `app/(student)/student/` backed by three query functions in `lib/student/queries.ts`. A `LessonCompletion` Prisma model tracks per-lesson progress. The student layout shell handles auth-guarding and nav — individual pages skip the session check. Tabs on the subject page are driven by `?tab=` search param (server-rendered, no client state).

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 7, TypeScript, Tailwind CSS 4, shadcn/ui

---

## File Map

| Action | File |
|---|---|
| Modify | `prisma/schema.prisma` |
| Create | `lib/auth/sign-out.ts` |
| Create | `lib/student/queries.ts` |
| Create | `components/student/sign-out-button.tsx` |
| Create | `components/student/nav.tsx` |
| Modify | `app/(student)/layout.tsx` |
| Modify | `app/(student)/student/dashboard/actions.ts` |
| Modify | `app/(student)/student/dashboard/additional-payment-form.tsx` |
| Modify | `app/(student)/student/dashboard/page.tsx` |
| Create | `app/(student)/student/courses/[id]/page.tsx` |
| Create | `app/(student)/student/courses/[id]/subjects/[sid]/actions.ts` |
| Create | `app/(student)/student/courses/[id]/subjects/[sid]/lesson-done-button.tsx` |
| Create | `app/(student)/student/courses/[id]/subjects/[sid]/tab-switcher.tsx` |
| Create | `app/(student)/student/courses/[id]/subjects/[sid]/page.tsx` |

---

## Task 1: Schema — Add LessonCompletion

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add LessonCompletion model and back-relations**

In `prisma/schema.prisma`, after the `PaymentProof` model add:

```prisma
model LessonCompletion {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  lessonId    String
  lesson      Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  completedAt DateTime @default(now())

  @@unique([userId, lessonId])
  @@index([userId])
}
```

In the `User` model, add the back-relation alongside the other relation fields:
```prisma
lessonCompletions LessonCompletion[]
```

In the `Lesson` model, add:
```prisma
completions LessonCompletion[]
```

- [ ] **Step 2: Run migration**

```bash
pnpm prisma migrate dev --name add_lesson_completion
```

Expected: migration created and applied, Prisma Client regenerated.

- [ ] **Step 3: Verify**

```bash
pnpm prisma generate
```

Expected: no errors. The `LessonCompletion` model is accessible via `db.lessonCompletion`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add LessonCompletion model for lesson progress tracking"
```

---

## Task 2: Sign-out server action

**Files:**
- Create: `lib/auth/sign-out.ts`

- [ ] **Step 1: Create the action**

```ts
// lib/auth/sign-out.ts
'use server'

import { clearSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'

export async function signOutAction() {
  await clearSession()
  redirect('/login')
}
```

- [ ] **Step 2: Lint check**

```bash
pnpm lint --quiet 2>&1 | grep "lib/auth/sign-out"
```

Expected: no output (no errors in this file).

- [ ] **Step 3: Commit**

```bash
git add lib/auth/sign-out.ts
git commit -m "feat(auth): add signOutAction server action"
```

---

## Task 3: Student query library

**Files:**
- Create: `lib/student/queries.ts`

- [ ] **Step 1: Create the file with all types and query functions**

```ts
// lib/student/queries.ts
import { db } from '@/lib/db'
import type { DayOfWeek, AssessmentType } from '@prisma/client'

// ─── Dashboard ───────────────────────────────────────────────────────────────

export type DashboardPaymentProof = {
  id: string
  amount: number
  note: string | null
  submittedAt: Date
}

export type DashboardEnrollment = {
  id: string
  courseId: string
  course: { title: string; imageUrl: string | null; tuitionFee: number | null }
  paymentStatus: 'PARTIALLY_PAID' | 'FULLY_PAID'
  totalPaid: number
  enrolledAt: Date
  totalLessons: number
  completedLessons: number
  paymentProofs: DashboardPaymentProof[]
}

export type DashboardSchedule = {
  subjectTitle: string
  day: DayOfWeek
  startTime: string
  endTime: string
}

export type DashboardAnnouncement = {
  id: string
  title: string
  content: string
  createdAt: Date
}

export type StudentDashboard = {
  enrollments: DashboardEnrollment[]
  schedules: DashboardSchedule[]
  announcements: DashboardAnnouncement[]
}

const DAY_NUM: Record<string, number> = {
  MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4,
  FRIDAY: 5, SATURDAY: 6, SUNDAY: 7,
}

export async function getStudentDashboard(userId: string): Promise<StudentDashboard> {
  const [enrollmentsRaw, announcements] = await Promise.all([
    db.enrollment.findMany({
      where: { userId },
      orderBy: { enrolledAt: 'desc' },
      select: {
        id: true,
        courseId: true,
        paymentStatus: true,
        totalPaid: true,
        enrolledAt: true,
        course: {
          select: {
            title: true,
            imageUrl: true,
            tuitionFee: true,
            subjects: {
              select: {
                title: true,
                lessons: { select: { id: true } },
                schedules: { select: { day: true, startTime: true, endTime: true } },
              },
            },
          },
        },
        paymentProofs: {
          orderBy: { submittedAt: 'desc' },
          select: { id: true, amount: true, note: true, submittedAt: true },
        },
      },
    }),
    db.announcement.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, content: true, createdAt: true },
    }),
  ])

  const allLessonIds = enrollmentsRaw.flatMap(e =>
    e.course.subjects.flatMap(s => s.lessons.map(l => l.id))
  )

  const completions =
    allLessonIds.length > 0
      ? await db.lessonCompletion.findMany({
          where: { userId, lessonId: { in: allLessonIds } },
          select: { lessonId: true },
        })
      : []
  const completedSet = new Set(completions.map(c => c.lessonId))

  const schedules: DashboardSchedule[] = []

  const enrollments: DashboardEnrollment[] = enrollmentsRaw.map(e => {
    let totalLessons = 0
    let completedLessons = 0

    for (const subject of e.course.subjects) {
      totalLessons += subject.lessons.length
      completedLessons += subject.lessons.filter(l => completedSet.has(l.id)).length
      for (const sched of subject.schedules) {
        schedules.push({ subjectTitle: subject.title, day: sched.day, startTime: sched.startTime, endTime: sched.endTime })
      }
    }

    return {
      id: e.id,
      courseId: e.courseId,
      course: {
        title: e.course.title,
        imageUrl: e.course.imageUrl,
        tuitionFee: e.course.tuitionFee?.toNumber() ?? null,
      },
      paymentStatus: e.paymentStatus,
      totalPaid: e.totalPaid.toNumber(),
      enrolledAt: e.enrolledAt,
      totalLessons,
      completedLessons,
      paymentProofs: e.paymentProofs.map(p => ({ ...p, amount: p.amount.toNumber() })),
    }
  })

  // Sort schedules by day of week starting from today
  const jsToday = new Date().getDay() // 0=Sun … 6=Sat
  const todayNum = jsToday === 0 ? 7 : jsToday // Mon=1 … Sun=7
  schedules.sort((a, b) => {
    const aDiff = ((DAY_NUM[a.day] ?? 1) - todayNum + 7) % 7
    const bDiff = ((DAY_NUM[b.day] ?? 1) - todayNum + 7) % 7
    if (aDiff !== bDiff) return aDiff - bDiff
    return a.startTime.localeCompare(b.startTime)
  })

  return { enrollments, schedules, announcements }
}

// ─── Course page ─────────────────────────────────────────────────────────────

export type CourseSubject = {
  id: string
  title: string
  description: string | null
  order: number
  totalLessons: number
  completedLessons: number
  schedules: Array<{ day: DayOfWeek; startTime: string; endTime: string }>
  teachers: Array<{ firstName: string; lastName: string }>
}

export type StudentCourse = {
  id: string
  title: string
  imageUrl: string | null
  totalLessons: number
  completedLessons: number
  subjects: CourseSubject[]
}

export async function getStudentCourse(
  userId: string,
  courseId: string,
): Promise<StudentCourse | null> {
  const [enrollment, course] = await Promise.all([
    db.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true },
    }),
    db.course.findUnique({
      where: { id: courseId, isPublished: true },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        subjects: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            order: true,
            lessons: { select: { id: true } },
            schedules: { select: { day: true, startTime: true, endTime: true } },
            teachers: {
              select: { user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
    }),
  ])

  if (!enrollment || !course) return null

  const allLessonIds = course.subjects.flatMap(s => s.lessons.map(l => l.id))
  const completions =
    allLessonIds.length > 0
      ? await db.lessonCompletion.findMany({
          where: { userId, lessonId: { in: allLessonIds } },
          select: { lessonId: true },
        })
      : []
  const completedSet = new Set(completions.map(c => c.lessonId))

  let totalLessons = 0
  let completedLessons = 0

  const subjects: CourseSubject[] = course.subjects.map(s => {
    const subTotal = s.lessons.length
    const subDone = s.lessons.filter(l => completedSet.has(l.id)).length
    totalLessons += subTotal
    completedLessons += subDone
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      order: s.order,
      totalLessons: subTotal,
      completedLessons: subDone,
      schedules: s.schedules,
      teachers: s.teachers.map(t => ({ firstName: t.user.firstName, lastName: t.user.lastName })),
    }
  })

  return { id: course.id, title: course.title, imageUrl: course.imageUrl, totalLessons, completedLessons, subjects }
}

// ─── Subject page ─────────────────────────────────────────────────────────────

export type StudentLesson = {
  id: string
  title: string
  description: string | null
  order: number
  materialUrl: string | null
  recordingUrl: string | null
  isCompleted: boolean
}

export type StudentAssessment = {
  id: string
  title: string
  type: AssessmentType
  durationMins: number | null
  maxAttempts: number | null
  bestScore: number | null
  attemptCount: number
}

export type StudentSubject = {
  id: string
  courseId: string
  title: string
  description: string | null
  course: { title: string }
  schedules: Array<{ day: DayOfWeek; startTime: string; endTime: string }>
  lessons: StudentLesson[]
  assessments: StudentAssessment[]
}

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
        select: { id: true, title: true, description: true, order: true, materialUrl: true, recordingUrl: true },
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
    select: { id: true },
  })
  if (!enrollment) return null

  const lessonIds = subject.lessons.map(l => l.id)
  const completions =
    lessonIds.length > 0
      ? await db.lessonCompletion.findMany({
          where: { userId, lessonId: { in: lessonIds } },
          select: { lessonId: true },
        })
      : []
  const completedSet = new Set(completions.map(c => c.lessonId))

  return {
    id: subject.id,
    courseId: subject.courseId,
    title: subject.title,
    description: subject.description,
    course: subject.course,
    schedules: subject.schedules,
    lessons: subject.lessons.map(l => ({ ...l, isCompleted: completedSet.has(l.id) })),
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

- [ ] **Step 2: Lint check**

```bash
pnpm lint --quiet 2>&1 | grep "lib/student"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add lib/student/queries.ts
git commit -m "feat(student): add student query library (dashboard, course, subject)"
```

---

## Task 4: Student nav components

**Files:**
- Create: `components/student/sign-out-button.tsx`
- Create: `components/student/nav.tsx`

- [ ] **Step 1: Create sign-out button**

```tsx
// components/student/sign-out-button.tsx
'use client'

import { signOutAction } from '@/lib/auth/sign-out'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" size="sm">
        Sign Out
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Create nav component**

```tsx
// components/student/nav.tsx
import Link from 'next/link'
import { SignOutButton } from './sign-out-button'

type Props = { firstName: string }

export function StudentNav({ firstName }: Props) {
  return (
    <header className="border-b bg-background sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/student/dashboard" className="font-semibold text-sm">
          Al-Qur&apos;an Academy
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">{firstName}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Lint check**

```bash
pnpm lint --quiet 2>&1 | grep "components/student"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add components/student/sign-out-button.tsx components/student/nav.tsx
git commit -m "feat(student): add student nav bar and sign-out button"
```

---

## Task 5: Student layout

**Files:**
- Modify: `app/(student)/layout.tsx`

- [ ] **Step 1: Replace with auth-guarded layout**

```tsx
// app/(student)/layout.tsx
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { StudentNav } from '@/components/student/nav'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session || session.role !== 'STUDENT') redirect('/login')

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { firstName: true },
  })

  return (
    <div className="min-h-screen flex flex-col">
      <StudentNav firstName={user?.firstName ?? ''} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Lint check**

```bash
pnpm lint --quiet 2>&1 | grep "student.*layout"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "app/(student)/layout.tsx"
git commit -m "feat(student): add auth-guarded layout with nav shell"
```

---

## Task 6: Update payment form to support multiple enrollments

**Files:**
- Modify: `app/(student)/student/dashboard/actions.ts`
- Modify: `app/(student)/student/dashboard/additional-payment-form.tsx`

The current action uses `findFirst` — it would pick the wrong enrollment if a student has multiple. We pass `enrollmentId` from the form instead.

- [ ] **Step 1: Update the action to accept enrollmentId**

Replace the `submitAdditionalPaymentAction` in `app/(student)/student/dashboard/actions.ts`. The only change is swapping `db.enrollment.findFirst({ where: { userId } })` to look up by a form-supplied `enrollmentId` while still verifying ownership:

```ts
  const enrollmentIdRaw = formData.get('enrollmentId')
  if (typeof enrollmentIdRaw !== 'string' || !enrollmentIdRaw) {
    return { error: 'Invalid enrollment.' }
  }

  // (replace the existing findFirst call with this)
  const enrollment = await db.enrollment.findFirst({
    where: { id: enrollmentIdRaw, userId: session.userId },
    select: { id: true, paymentStatus: true },
  })
```

The full updated function (replace existing):

```ts
export async function submitAdditionalPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'STUDENT') return { error: 'Forbidden' }

  const enrollmentIdRaw = formData.get('enrollmentId')
  if (typeof enrollmentIdRaw !== 'string' || !enrollmentIdRaw) {
    return { error: 'Invalid enrollment.' }
  }

  const amountRaw = formData.get('amount')
  const amount = parseFloat(typeof amountRaw === 'string' ? amountRaw : '')
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Amount must be greater than 0.' }
  }

  const noteRaw = formData.get('note')
  const note = typeof noteRaw === 'string' && noteRaw.trim() ? noteRaw.trim() : null

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Please select a file to upload.' }
  if (!ALLOWED_TYPES.includes(file.type as typeof ALLOWED_TYPES[number])) {
    return { error: 'Only JPG, PNG, and WEBP images are accepted.' }
  }
  if (file.size > MAX_SIZE) return { error: 'File size must be 5MB or less.' }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (!validateImageMagicBytes(buffer, file.type)) {
    return { error: 'Invalid image file. Only JPG, PNG, and WEBP images are accepted.' }
  }

  const enrollment = await db.enrollment.findFirst({
    where: { id: enrollmentIdRaw, userId: session.userId },
    select: { id: true, paymentStatus: true },
  })
  if (!enrollment) return { error: 'Enrollment not found.' }
  if (enrollment.paymentStatus === 'FULLY_PAID') {
    return { error: 'Your enrollment is already fully paid.' }
  }

  const timestamp = Date.now()
  const ext = EXT[file.type]
  const storagePath = `proof/${enrollment.id}/${timestamp}.${ext}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET!)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('[additionalPayment] Supabase error:', uploadError)
    return { error: 'Failed to upload file. Please try again.' }
  }

  try {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.paymentProof.create({
        data: { enrollmentId: enrollment.id, proofUrl: storagePath, amount, note },
      })
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { totalPaid: { increment: amount } },
      })
    })
  } catch (err) {
    console.error('[additionalPayment] DB error:', err)
    return { error: 'File uploaded but record could not be saved. Please contact support.' }
  }

  revalidatePath('/student/dashboard')
  return { error: null, success: true }
}
```

- [ ] **Step 2: Update AdditionalPaymentForm to accept enrollmentId**

```tsx
// app/(student)/student/dashboard/additional-payment-form.tsx
'use client'

import { useActionState } from 'react'
import { submitAdditionalPaymentAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ActionState = { error: string | null; success?: boolean }
type Props = { enrollmentId: string }

export function AdditionalPaymentForm({ enrollmentId }: Props) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    submitAdditionalPaymentAction,
    { error: null },
  )

  if (state.success) {
    return (
      <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-3">
        Payment proof submitted. An admin will review it and update your payment status.
      </p>
    )
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <div className="space-y-2">
        <Label htmlFor={'amount-' + enrollmentId}>Amount Paid (₱)</Label>
        <Input id={'amount-' + enrollmentId} name="amount" type="number" min="1" step="0.01" required placeholder="e.g. 5000" />
      </div>
      <div className="space-y-2">
        <Label htmlFor={'note-' + enrollmentId}>Note (optional)</Label>
        <Input id={'note-' + enrollmentId} name="note" placeholder="e.g. 2nd installment via GCash" />
      </div>
      <div className="space-y-2">
        <Label htmlFor={'file-' + enrollmentId}>Proof of Payment</Label>
        <Input id={'file-' + enrollmentId} name="file" type="file" accept="image/jpeg,image/png,image/webp" required />
        <p className="text-xs text-muted-foreground">Accepted: JPG, PNG, WEBP. Max 5MB.</p>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Uploading...' : 'Submit Payment Proof'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Lint check**

```bash
pnpm lint --quiet 2>&1 | grep "dashboard"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add "app/(student)/student/dashboard/actions.ts" "app/(student)/student/dashboard/additional-payment-form.tsx"
git commit -m "fix(student): scope payment submission to specific enrollment"
```

---

## Task 7: Dashboard page redesign

**Files:**
- Modify: `app/(student)/student/dashboard/page.tsx`

Two shared helpers used only in this file:

```ts
function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${mStr} ${period}`
}

const DAY_LABEL: Record<string, string> = {
  MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed',
  THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun',
}
```

- [ ] **Step 1: Replace page.tsx**

```tsx
// app/(student)/student/dashboard/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getSession } from '@/lib/auth/session'
import { getStudentDashboard } from '@/lib/student/queries'
import { AdditionalPaymentForm } from './additional-payment-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${mStr} ${period}`
}

const DAY_LABEL: Record<string, string> = {
  MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed',
  THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun',
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export const metadata = { title: 'Dashboard — AQA Student' }

export default async function StudentDashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const { enrollments, schedules, announcements } = await getStudentDashboard(session.userId)

  const partialEnrollments = enrollments.filter(e => e.paymentStatus === 'PARTIALLY_PAID')

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">

      {/* Welcome */}
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Schedules strip */}
      {schedules.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Upcoming Schedule</h2>
          <div className="flex flex-wrap gap-2">
            {schedules.map((s, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
              >
                <span className="font-semibold">{s.subjectTitle}</span>
                <span className="text-muted-foreground">·</span>
                <span>{DAY_LABEL[s.day]} {formatTime(s.startTime)}–{formatTime(s.endTime)}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Announcements</h2>
          <div className="space-y-3">
            {announcements.slice(0, 3).map(a => (
              <Card key={a.id}>
                <CardContent className="pt-4 pb-4">
                  <p className="font-medium text-sm">{a.title}</p>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{a.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* My Courses */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">My Courses</h2>
        {enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active enrollments.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {enrollments.map(e => {
              const pct = e.totalLessons > 0
                ? Math.round((e.completedLessons / e.totalLessons) * 100)
                : 0
              return (
                <Link key={e.id} href={'/student/courses/' + e.courseId} className="block group">
                  <Card className="h-full hover:border-primary transition-colors">
                    {e.course.imageUrl && (
                      <div className="relative h-32 w-full overflow-hidden rounded-t-lg">
                        <Image src={e.course.imageUrl} alt={e.course.title} fill className="object-cover" />
                      </div>
                    )}
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors">
                          {e.course.title}
                        </p>
                        <Badge
                          className={
                            e.paymentStatus === 'FULLY_PAID'
                              ? 'bg-green-100 text-green-800 border-green-200 shrink-0'
                              : 'bg-yellow-100 text-yellow-800 border-yellow-200 shrink-0'
                          }
                        >
                          {e.paymentStatus === 'FULLY_PAID' ? 'Fully Paid' : 'Partially Paid'}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: pct + '%' }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {e.completedLessons} of {e.totalLessons} lessons completed
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Payment summary */}
      {partialEnrollments.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Payment</h2>
          <div className="space-y-4">
            {partialEnrollments.map(e => (
              <Card key={e.id}>
                <CardHeader>
                  <CardTitle className="text-base">{e.course.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 text-sm">
                    <span>
                      <span className="text-muted-foreground">Paid: </span>
                      <strong>₱{e.totalPaid.toLocaleString('en-PH')}</strong>
                    </span>
                    {e.course.tuitionFee !== null && (
                      <span>
                        <span className="text-muted-foreground">Balance: </span>
                        <strong>₱{(e.course.tuitionFee - e.totalPaid).toLocaleString('en-PH')}</strong>
                      </span>
                    )}
                  </div>
                  {e.paymentProofs.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Payment history</p>
                      <div className="divide-y border rounded-md">
                        {e.paymentProofs.map(p => (
                          <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                            <div>
                              <span className="font-medium">₱{p.amount.toLocaleString('en-PH')}</span>
                              {p.note && <span className="text-muted-foreground ml-2">— {p.note}</span>}
                              <p className="text-xs text-muted-foreground">{dateFormatter.format(p.submittedAt)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-3">Submit Additional Payment</p>
                    <AdditionalPaymentForm enrollmentId={e.id} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Lint check**

```bash
pnpm lint --quiet 2>&1 | grep "dashboard/page"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "app/(student)/student/dashboard/page.tsx"
git commit -m "feat(student): redesign dashboard with courses, schedules, announcements, payment"
```

---

## Task 8: Course page

**Files:**
- Create: `app/(student)/student/courses/[id]/page.tsx`

- [ ] **Step 1: Create the course page**

```tsx
// app/(student)/student/courses/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { getStudentCourse } from '@/lib/student/queries'
import type { DayOfWeek } from '@prisma/client'

type Props = { params: Promise<{ id: string }> }

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${mStr} ${period}`
}

const DAY_LABEL: Record<string, string> = {
  MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed',
  THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun',
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  return { title: 'Course — AQA Student' }
}

export default async function StudentCoursePage({ params }: Props) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const course = await getStudentCourse(session.userId, id)
  if (!course) notFound()

  const pct = course.totalLessons > 0
    ? Math.round((course.completedLessons / course.totalLessons) * 100)
    : 0

  const hasTeachers = course.subjects.some(s => s.teachers.length > 0)

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <Link
          href="/student/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Dashboard
        </Link>
        {course.imageUrl && (
          <div className="relative h-40 w-full overflow-hidden rounded-xl">
            <Image src={course.imageUrl} alt={course.title} fill className="object-cover" />
          </div>
        )}
        <h1 className="text-2xl font-bold">{course.title}</h1>
      </div>

      {/* Overall progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Overall Progress</span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: pct + '%' }} />
        </div>
        <p className="text-xs text-muted-foreground">
          {course.completedLessons} of {course.totalLessons} lessons completed
        </p>
      </div>

      {/* Subjects */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Subjects</h2>
        {course.subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subjects available yet.</p>
        ) : (
          <div className="divide-y border rounded-lg overflow-hidden">
            {course.subjects.map(subject => {
              const subPct = subject.totalLessons > 0
                ? Math.round((subject.completedLessons / subject.totalLessons) * 100)
                : 0
              return (
                <Link
                  key={subject.id}
                  href={'/student/courses/' + id + '/subjects/' + subject.id}
                  className="flex items-center justify-between px-4 py-4 hover:bg-muted/50 transition-colors group"
                >
                  <div className="space-y-1 flex-1 min-w-0 pr-4">
                    <p className="font-medium text-sm group-hover:text-primary transition-colors">
                      {subject.title}
                    </p>
                    {subject.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{subject.description}</p>
                    )}
                    {subject.schedules.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {subject.schedules.map((s, i) => (
                          <span key={i} className="text-xs text-muted-foreground">
                            {DAY_LABEL[s.day]} {formatTime(s.startTime)}–{formatTime(s.endTime)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 w-28 space-y-1 text-right">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: subPct + '%' }} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {subject.completedLessons} / {subject.totalLessons} lessons
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Teachers */}
      {hasTeachers && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Teachers</h2>
          <div className="space-y-1 text-sm">
            {course.subjects
              .filter(s => s.teachers.length > 0)
              .map(s => (
                <p key={s.id}>
                  <span className="font-medium">{s.title}:</span>{' '}
                  <span className="text-muted-foreground">
                    {s.teachers.map(t => t.firstName + ' ' + t.lastName).join(', ')}
                  </span>
                </p>
              ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Lint check**

```bash
pnpm lint --quiet 2>&1 | grep "courses/\[id\]/page"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "app/(student)/student/courses/[id]/page.tsx"
git commit -m "feat(student): add course page with subjects and progress"
```

---

## Task 9: Lesson done server actions

**Files:**
- Create: `app/(student)/student/courses/[id]/subjects/[sid]/actions.ts`

- [ ] **Step 1: Create the actions file**

```ts
// app/(student)/student/courses/[id]/subjects/[sid]/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

type ActionState = { error: string | null }

export async function markLessonDoneAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const lessonId = formData.get('lessonId')
  const courseId = formData.get('courseId')
  const subjectId = formData.get('subjectId')
  if (typeof lessonId !== 'string' || !lessonId) return { error: 'Invalid lesson.' }
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course.' }
  if (typeof subjectId !== 'string' || !subjectId) return { error: 'Invalid subject.' }

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: session.userId, courseId } },
    select: { id: true },
  })
  if (!enrollment) return { error: 'Not enrolled in this course.' }

  await db.lessonCompletion.upsert({
    where: { userId_lessonId: { userId: session.userId, lessonId } },
    create: { userId: session.userId, lessonId },
    update: {},
  })

  revalidatePath('/student/courses/' + courseId + '/subjects/' + subjectId)
  revalidatePath('/student/courses/' + courseId)
  revalidatePath('/student/dashboard')
  return { error: null }
}

export async function unmarkLessonDoneAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const lessonId = formData.get('lessonId')
  const courseId = formData.get('courseId')
  const subjectId = formData.get('subjectId')
  if (typeof lessonId !== 'string' || !lessonId) return { error: 'Invalid lesson.' }
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course.' }
  if (typeof subjectId !== 'string' || !subjectId) return { error: 'Invalid subject.' }

  await db.lessonCompletion.deleteMany({
    where: { userId: session.userId, lessonId },
  })

  revalidatePath('/student/courses/' + courseId + '/subjects/' + subjectId)
  revalidatePath('/student/courses/' + courseId)
  revalidatePath('/student/dashboard')
  return { error: null }
}
```

- [ ] **Step 2: Lint check**

```bash
pnpm lint --quiet 2>&1 | grep "subjects/\[sid\]/actions"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "app/(student)/student/courses/[id]/subjects/[sid]/actions.ts"
git commit -m "feat(student): add mark/unmark lesson done server actions"
```

---

## Task 10: LessonDoneButton client component

**Files:**
- Create: `app/(student)/student/courses/[id]/subjects/[sid]/lesson-done-button.tsx`

- [ ] **Step 1: Create the component**

Both hooks are called unconditionally (React rules), the correct `formAction` is selected at render time based on `isCompleted`.

```tsx
// app/(student)/student/courses/[id]/subjects/[sid]/lesson-done-button.tsx
'use client'

import { useActionState } from 'react'
import { markLessonDoneAction, unmarkLessonDoneAction } from './actions'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'

type Props = {
  lessonId: string
  subjectId: string
  courseId: string
  isCompleted: boolean
}

export function LessonDoneButton({ lessonId, subjectId, courseId, isCompleted }: Props) {
  const [, markAction, markPending] = useActionState(markLessonDoneAction, { error: null })
  const [, unmarkAction, unmarkPending] = useActionState(unmarkLessonDoneAction, { error: null })

  const isPending = markPending || unmarkPending
  const formAction = isCompleted ? unmarkAction : markAction

  return (
    <form action={formAction}>
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <input type="hidden" name="courseId" value={courseId} />
      <Button
        type="submit"
        variant={isCompleted ? 'default' : 'outline'}
        size="sm"
        disabled={isPending}
        className={isCompleted ? 'bg-green-600 hover:bg-green-700' : ''}
      >
        {isCompleted ? (
          <><Check className="w-3 h-3 mr-1" aria-hidden="true" />Done</>
        ) : (
          'Mark as Done'
        )}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Lint check**

```bash
pnpm lint --quiet 2>&1 | grep "lesson-done-button"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "app/(student)/student/courses/[id]/subjects/[sid]/lesson-done-button.tsx"
git commit -m "feat(student): add LessonDoneButton toggle component"
```

---

## Task 11: Subject page tab switcher

**Files:**
- Create: `app/(student)/student/courses/[id]/subjects/[sid]/tab-switcher.tsx`

- [ ] **Step 1: Create tab switcher**

Tabs are driven by `?tab=lessons` (default) / `?tab=assessments`. Uses `useSearchParams` to avoid full navigation.

```tsx
// app/(student)/student/courses/[id]/subjects/[sid]/tab-switcher.tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

type Tab = 'lessons' | 'assessments'
type Props = { activeTab: Tab }

export function TabSwitcher({ activeTab }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function switchTab(tab: Tab) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.push('?' + params.toString())
  }

  return (
    <div className="flex gap-1 border-b border-border">
      {(['lessons', 'assessments'] as const).map(tab => (
        <button
          key={tab}
          onClick={() => switchTab(tab)}
          className={cn(
            'px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
            activeTab === tab
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Lint check**

```bash
pnpm lint --quiet 2>&1 | grep "tab-switcher"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "app/(student)/student/courses/[id]/subjects/[sid]/tab-switcher.tsx"
git commit -m "feat(student): add subject page tab switcher"
```

---

## Task 12: Subject page

**Files:**
- Create: `app/(student)/student/courses/[id]/subjects/[sid]/page.tsx`

- [ ] **Step 1: Create the subject page**

```tsx
// app/(student)/student/courses/[id]/subjects/[sid]/page.tsx
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { getStudentSubject } from '@/lib/student/queries'
import { Badge } from '@/components/ui/badge'
import { LessonDoneButton } from './lesson-done-button'
import { TabSwitcher } from './tab-switcher'

type Props = {
  params: Promise<{ id: string; sid: string }>
  searchParams: Promise<{ tab?: string }>
}

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${mStr} ${period}`
}

const DAY_LABEL: Record<string, string> = {
  MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed',
  THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun',
}

export async function generateMetadata({ params }: Props) {
  const { sid } = await params
  return { title: 'Subject — AQA Student' }
}

export default async function StudentSubjectPage({ params, searchParams }: Props) {
  const { id, sid } = await params
  const { tab: rawTab } = await searchParams
  const activeTab = rawTab === 'assessments' ? 'assessments' : 'lessons'

  const session = await getSession()
  if (!session) redirect('/login')

  const subject = await getStudentSubject(session.userId, sid)
  if (!subject || subject.courseId !== id) notFound()

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Link
          href={'/student/courses/' + id}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          {subject.course.title}
        </Link>
        <h1 className="text-2xl font-bold">{subject.title}</h1>
        {subject.schedules.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {subject.schedules.map((s, i) => (
              <span key={i} className="text-sm text-muted-foreground">
                {DAY_LABEL[s.day]} {formatTime(s.startTime)}–{formatTime(s.endTime)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <Suspense fallback={null}>
        <TabSwitcher activeTab={activeTab} />
      </Suspense>

      {/* Lessons tab */}
      {activeTab === 'lessons' && (
        <div className="space-y-2">
          {subject.lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No lessons yet.</p>
          ) : (
            <div className="divide-y border rounded-lg overflow-hidden">
              {subject.lessons.map(lesson => (
                <div
                  key={lesson.id}
                  className={
                    'flex items-center justify-between px-4 py-4 gap-4 ' +
                    (lesson.isCompleted ? 'bg-muted/30' : '')
                  }
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className={
                      'font-medium text-sm ' +
                      (lesson.isCompleted ? 'text-muted-foreground line-through' : '')
                    }>
                      {lesson.title}
                    </p>
                    {lesson.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{lesson.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {lesson.materialUrl && (
                        <a
                          href={lesson.materialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          Materials <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      )}
                      {lesson.recordingUrl && (
                        <a
                          href={lesson.recordingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          Recording <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <LessonDoneButton
                      lessonId={lesson.id}
                      subjectId={sid}
                      courseId={id}
                      isCompleted={lesson.isCompleted}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assessments tab */}
      {activeTab === 'assessments' && (
        <div className="space-y-2">
          {subject.assessments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No assessments yet.</p>
          ) : (
            <div className="divide-y border rounded-lg overflow-hidden">
              {subject.assessments.map(assessment => (
                <div key={assessment.id} className="flex items-center justify-between px-4 py-4 gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{assessment.title}</p>
                      <Badge variant="outline" className="text-xs">
                        {assessment.type === 'QUIZ' ? 'Quiz' : 'Exam'}
                      </Badge>
                      {assessment.durationMins && (
                        <span className="text-xs text-muted-foreground">{assessment.durationMins} min</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {assessment.bestScore !== null
                        ? 'Best score: ' + assessment.bestScore.toFixed(1) + '%'
                        : 'Not attempted'}
                      {assessment.maxAttempts !== null && (
                        <span> · {assessment.attemptCount}/{assessment.maxAttempts} attempts used</span>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {/* Assessment taking is out of scope — placeholder */}
                    <span className="text-xs text-muted-foreground italic">Coming soon</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Lint check**

```bash
pnpm lint --quiet 2>&1 | grep "subjects/\[sid\]/page"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "app/(student)/student/courses/[id]/subjects/[sid]/page.tsx"
git commit -m "feat(student): add subject page with lessons and assessments tabs"
```

---

## Task 13: Full lint + build verification

- [ ] **Step 1: Run lint**

```bash
pnpm lint 2>&1 | grep -E "(student|LessonCompletion)" | grep -v "warning"
```

Expected: no errors in student-related files.

- [ ] **Step 2: Run build**

```bash
pnpm build 2>&1 | tail -20
```

Expected: build succeeds. All student routes listed in the output (dashboard, courses/[id], courses/[id]/subjects/[sid]).

- [ ] **Step 3: Manual smoke test**

Start dev server (`pnpm dev`), log in as a student, and verify:
1. Dashboard shows course cards with progress bar, schedule strip, announcements, and payment section for partially-paid enrollments
2. Clicking a course card navigates to the course page showing subjects with mini progress bars
3. Clicking a subject row navigates to the subject page showing the Lessons tab by default
4. Clicking "Mark as Done" on a lesson marks it and updates progress on the course page and dashboard
5. Clicking the Assessments tab shows the assessments list
6. Sign Out button clears session and redirects to `/login`
