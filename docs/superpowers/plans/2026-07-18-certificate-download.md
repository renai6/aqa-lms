# Certificate Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a student download a course-completion certificate from their dashboard, gated on a passing weighted average with every subject graded.

**Architecture:** Pure computation lives in `lib/grades/compute.ts` and `lib/certificates/{eligibility,number}.ts` (unit-tested, no db). Db-aware loaders in `lib/certificates/{queries,issue}.ts` reuse the pure logic. A server-rendered print page at `/student/certificate/[courseId]` recomputes eligibility, auto-issues an idempotent `Certificate` row, and renders an on-brand A4 certificate saved via `window.print()`. The dashboard gains a "Certificates" section listing each enrolled course with an enabled or disabled download.

**Tech Stack:** Next.js 16 (App Router, RSC), Prisma 7 + Postgres, Tailwind v4, shadcn/radix, Vitest.

## Global Constraints

- Package manager is **pnpm** only. Never npm/yarn.
- No em dashes in code comments or copy. Use plain `-`.
- Primary brand color is `#601426` (Tailwind `primary`); text uses the zinc palette; font is `--font-sans` (Poppins).
- All grade values are percentages (0-100 floats). Course passing threshold is `Course.passingGrade` (default 75), configurable per course - never hardcode 75 in logic or copy.
- Eligibility must always be recomputed server-side; never trust the client.
- Subject visibility is gender-filtered via `subjectGenderFilter(userGender)` from `@/lib/subjects/visibility` - certificate logic must use the same filter.
- Session is read via `getSession()` from `@/lib/auth/session`, returning `{ userId, role } | null`.
- The db client is `import { db } from '@/lib/db'`.

---

### Task 1: Add `[userId, courseId]` unique constraint to Certificate

**Files:**
- Modify: `prisma/schema.prisma` (Certificate model, around lines 483-496)

**Interfaces:**
- Produces: a compound unique `userId_courseId` on `Certificate`, enabling `db.certificate.upsert({ where: { userId_courseId: { userId, courseId } }, ... })` in later tasks.

- [ ] **Step 1: Add the constraint**

In `prisma/schema.prisma`, add `@@unique([userId, courseId])` to the `Certificate` model (after the `issuedAt` line, before the closing brace):

```prisma
model Certificate {
  id String @id @default(cuid())

  userId String
  user   User   @relation(fields: [userId], references: [id])

  courseId String
  course   Course @relation(fields: [courseId], references: [id])

  certificateNo String  @unique
  pdfUrl        String?

  issuedAt DateTime @default(now())

  @@unique([userId, courseId])
}
```

- [ ] **Step 2: Create and apply the migration**

Run: `pnpm prisma migrate dev --name certificate_unique_user_course`
Expected: a new folder under `prisma/migrations/` and "Your database is now in sync with your schema." Prisma Client regenerates automatically.

- [ ] **Step 3: Verify the client typechecks with the compound key**

Run: `pnpm exec tsc --noEmit`
Expected: no errors (exit 0). This confirms the generated client picked up `userId_courseId`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add unique constraint on Certificate(userId, courseId)"
```

---

### Task 2: `weightedCourseGrade` pure function

**Files:**
- Modify: `lib/grades/compute.ts`
- Test: `lib/__tests__/grades/compute.test.ts`

**Interfaces:**
- Produces: `weightedCourseGrade(items: WeightedCourseItem[]): number | null` where `WeightedCourseItem = { units: number; finalGrade: number }`. Weighted average of `finalGrade` by `units`; returns null when the item list is empty or total units is 0.

- [ ] **Step 1: Write the failing tests**

Append to `lib/__tests__/grades/compute.test.ts`:

```ts
import { weightedCourseGrade } from '@/lib/grades/compute'

describe('weightedCourseGrade', () => {
  it('returns null for no subjects', () => {
    expect(weightedCourseGrade([])).toBeNull()
  })

  it('returns null when total units is zero', () => {
    expect(weightedCourseGrade([{ units: 0, finalGrade: 90 }])).toBeNull()
  })

  it('averages equally when units are equal', () => {
    expect(
      weightedCourseGrade([
        { units: 1, finalGrade: 80 },
        { units: 1, finalGrade: 100 },
      ]),
    ).toBe(90)
  })

  it('weights subjects by their units', () => {
    // 80 at 1 unit, 100 at 3 units -> (80 + 300) / 4 = 95
    expect(
      weightedCourseGrade([
        { units: 1, finalGrade: 80 },
        { units: 3, finalGrade: 100 },
      ]),
    ).toBe(95)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- --run lib/__tests__/grades/compute.test.ts`
Expected: FAIL - `weightedCourseGrade is not a function` / import error.

- [ ] **Step 3: Implement the function**

Append to `lib/grades/compute.ts`:

```ts
export type WeightedCourseItem = { units: number; finalGrade: number }

// Weighted average of subject final grades by Subject.units.
// Returns null when there are no items or the total units is 0.
export function weightedCourseGrade(
  items: WeightedCourseItem[],
): number | null {
  let unitSum = 0
  let weightedTotal = 0
  for (const { units, finalGrade } of items) {
    unitSum += units
    weightedTotal += units * finalGrade
  }
  return unitSum > 0 ? weightedTotal / unitSum : null
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- --run lib/__tests__/grades/compute.test.ts`
Expected: PASS (all `weightedSubjectGrade` and `weightedCourseGrade` tests green).

- [ ] **Step 5: Commit**

```bash
git add lib/grades/compute.ts lib/__tests__/grades/compute.test.ts
git commit -m "feat: add weightedCourseGrade computation"
```

---

### Task 3: `certificateEligibility` pure function

**Files:**
- Create: `lib/certificates/eligibility.ts`
- Test: `lib/__tests__/certificates/eligibility.test.ts`

**Interfaces:**
- Consumes: `weightedCourseGrade` and `WeightedCourseItem` from `@/lib/grades/compute` (Task 2).
- Produces:
  - `type SubjectGradeInput = { units: number; finalGrade: number | null }`
  - `type CertificateEligibility = { eligible: boolean; allGraded: boolean; courseGrade: number | null; passingGrade: number; gradedCount: number; totalSubjects: number }`
  - `certificateEligibility(subjects: SubjectGradeInput[], passingGrade: number): CertificateEligibility`

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/certificates/eligibility.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { certificateEligibility } from '@/lib/certificates/eligibility'

describe('certificateEligibility', () => {
  it('is not eligible when there are no subjects', () => {
    const r = certificateEligibility([], 75)
    expect(r.eligible).toBe(false)
    expect(r.allGraded).toBe(false)
    expect(r.courseGrade).toBeNull()
    expect(r.totalSubjects).toBe(0)
  })

  it('is not eligible when a subject is ungraded', () => {
    const r = certificateEligibility(
      [
        { units: 1, finalGrade: 90 },
        { units: 1, finalGrade: null },
      ],
      75,
    )
    expect(r.allGraded).toBe(false)
    expect(r.gradedCount).toBe(1)
    expect(r.eligible).toBe(false)
  })

  it('is not eligible when the weighted average is below passing', () => {
    // 60 and 70 at equal units -> 65 < 75
    const r = certificateEligibility(
      [
        { units: 1, finalGrade: 60 },
        { units: 1, finalGrade: 70 },
      ],
      75,
    )
    expect(r.allGraded).toBe(true)
    expect(r.courseGrade).toBe(65)
    expect(r.eligible).toBe(false)
  })

  it('is eligible when all graded and the weighted average meets passing', () => {
    // 70 at 1 unit, 90 at 3 units -> 85 >= 75
    const r = certificateEligibility(
      [
        { units: 1, finalGrade: 70 },
        { units: 3, finalGrade: 90 },
      ],
      75,
    )
    expect(r.allGraded).toBe(true)
    expect(r.courseGrade).toBe(85)
    expect(r.eligible).toBe(true)
  })

  it('respects a custom passing grade', () => {
    const r = certificateEligibility([{ units: 1, finalGrade: 80 }], 90)
    expect(r.passingGrade).toBe(90)
    expect(r.eligible).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- --run lib/__tests__/certificates/eligibility.test.ts`
Expected: FAIL - cannot find module `@/lib/certificates/eligibility`.

- [ ] **Step 3: Implement the function**

Create `lib/certificates/eligibility.ts`:

```ts
import { weightedCourseGrade } from '@/lib/grades/compute'

export type SubjectGradeInput = { units: number; finalGrade: number | null }

export type CertificateEligibility = {
  eligible: boolean
  allGraded: boolean
  courseGrade: number | null
  passingGrade: number
  gradedCount: number
  totalSubjects: number
}

// Pure eligibility check. A student may download a course certificate when
// every subject has a final grade AND the units-weighted average of those
// grades meets the course passing grade.
export function certificateEligibility(
  subjects: SubjectGradeInput[],
  passingGrade: number,
): CertificateEligibility {
  const totalSubjects = subjects.length
  const gradedCount = subjects.filter((s) => s.finalGrade != null).length
  const allGraded = totalSubjects > 0 && gradedCount === totalSubjects

  const courseGrade = weightedCourseGrade(
    subjects
      .filter((s): s is { units: number; finalGrade: number } => s.finalGrade != null)
      .map((s) => ({ units: s.units, finalGrade: s.finalGrade })),
  )

  const eligible = allGraded && courseGrade != null && courseGrade >= passingGrade

  return { eligible, allGraded, courseGrade, passingGrade, gradedCount, totalSubjects }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- --run lib/__tests__/certificates/eligibility.test.ts`
Expected: PASS (5 tests green).

- [ ] **Step 5: Commit**

```bash
git add lib/certificates/eligibility.ts lib/__tests__/certificates/eligibility.test.ts
git commit -m "feat: add pure certificate eligibility check"
```

---

### Task 4: `generateCertificateNo` pure function

**Files:**
- Create: `lib/certificates/number.ts`
- Test: `lib/__tests__/certificates/number.test.ts`

**Interfaces:**
- Produces: `generateCertificateNo(now?: Date): string` returning `AQA-<YYYY>-<6 uppercase hex>`.

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/certificates/number.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateCertificateNo } from '@/lib/certificates/number'

describe('generateCertificateNo', () => {
  it('matches AQA-<year>-<6 hex> and uses the given year', () => {
    const no = generateCertificateNo(new Date('2026-07-18T00:00:00Z'))
    expect(no).toMatch(/^AQA-2026-[0-9A-F]{6}$/)
  })

  it('produces distinct numbers across calls', () => {
    const a = generateCertificateNo()
    const b = generateCertificateNo()
    expect(a).not.toBe(b)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- --run lib/__tests__/certificates/number.test.ts`
Expected: FAIL - cannot find module `@/lib/certificates/number`.

- [ ] **Step 3: Implement the function**

Create `lib/certificates/number.ts`:

```ts
import { randomBytes } from 'crypto'

// Human-readable certificate number: AQA-<year>-<6 uppercase hex chars>.
// The 6 hex chars come from 3 random bytes. Uniqueness is enforced by the
// certificateNo @unique column; this only needs to be readable and collision
// resistant.
export function generateCertificateNo(now: Date = new Date()): string {
  const suffix = randomBytes(3).toString('hex').toUpperCase()
  return `AQA-${now.getFullYear()}-${suffix}`
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- --run lib/__tests__/certificates/number.test.ts`
Expected: PASS (2 tests green).

- [ ] **Step 5: Commit**

```bash
git add lib/certificates/number.ts lib/__tests__/certificates/number.test.ts
git commit -m "feat: add certificate number generator"
```

---

### Task 5: Db layer - eligibility queries and issuance

**Files:**
- Create: `lib/certificates/queries.ts`
- Create: `lib/certificates/issue.ts`

**Interfaces:**
- Consumes: `certificateEligibility`, `SubjectGradeInput`, `CertificateEligibility` (Task 3); `generateCertificateNo` (Task 4); `subjectGenderFilter` from `@/lib/subjects/visibility`; `getUserGender` from `@/lib/subjects/access`; `db` from `@/lib/db`.
- Produces:
  - `getCertificateEligibility(userId: string, courseId: string): Promise<{ courseTitle: string; eligibility: CertificateEligibility } | null>` (null when the course does not exist)
  - `type CertificateListItem = { courseId: string; courseTitle: string; eligible: boolean; allGraded: boolean; courseGrade: number | null; passingGrade: number; gradedCount: number; totalSubjects: number }`
  - `getStudentCertificates(userId: string): Promise<CertificateListItem[]>` (one item per enrolled course that has at least one visible subject)
  - `issueCertificate(userId: string, courseId: string): Promise<{ certificateNo: string; issuedAt: Date }>`

> These files touch the db, so they follow the repo convention of no unit tests (compare `lib/student/queries.ts`). They are verified by typecheck here and by the manual end-to-end check in Task 7.

- [ ] **Step 1: Create the queries file**

Create `lib/certificates/queries.ts`:

```ts
import { db } from '@/lib/db'
import { getUserGender } from '@/lib/subjects/access'
import { subjectGenderFilter } from '@/lib/subjects/visibility'
import {
  certificateEligibility,
  type CertificateEligibility,
  type SubjectGradeInput,
} from '@/lib/certificates/eligibility'

// Eligibility for a single course, plus its title (for the certificate page).
// Returns null when the course does not exist. Uses the gender filter so a
// subject restricted to the other gender is never counted.
export async function getCertificateEligibility(
  userId: string,
  courseId: string,
): Promise<{ courseTitle: string; eligibility: CertificateEligibility } | null> {
  const userGender = await getUserGender(userId)
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      title: true,
      passingGrade: true,
      subjects: {
        where: subjectGenderFilter(userGender),
        select: { id: true, units: true },
      },
    },
  })
  if (!course) return null

  const subjectIds = course.subjects.map((s) => s.id)
  const grades =
    subjectIds.length > 0
      ? await db.grade.findMany({
          where: { userId, subjectId: { in: subjectIds } },
          select: { subjectId: true, finalGrade: true },
        })
      : []
  const gradeMap = new Map(grades.map((g) => [g.subjectId, g.finalGrade]))

  const inputs: SubjectGradeInput[] = course.subjects.map((s) => ({
    units: s.units,
    finalGrade: gradeMap.get(s.id) ?? null,
  }))

  return {
    courseTitle: course.title,
    eligibility: certificateEligibility(inputs, course.passingGrade),
  }
}

export type CertificateListItem = {
  courseId: string
  courseTitle: string
} & CertificateEligibility

// One row per enrolled course that has at least one visible subject. Loads all
// enrollments and the student's grades in two queries, then computes per course.
export async function getStudentCertificates(
  userId: string,
): Promise<CertificateListItem[]> {
  const userGender = await getUserGender(userId)
  const enrollments = await db.enrollment.findMany({
    where: { userId },
    orderBy: { enrolledAt: 'desc' },
    select: {
      courseId: true,
      course: {
        select: {
          title: true,
          passingGrade: true,
          subjects: {
            where: subjectGenderFilter(userGender),
            select: { id: true, units: true },
          },
        },
      },
    },
  })

  const allSubjectIds = enrollments.flatMap((e) => e.course.subjects.map((s) => s.id))
  const grades =
    allSubjectIds.length > 0
      ? await db.grade.findMany({
          where: { userId, subjectId: { in: allSubjectIds } },
          select: { subjectId: true, finalGrade: true },
        })
      : []
  const gradeMap = new Map(grades.map((g) => [g.subjectId, g.finalGrade]))

  return enrollments
    .filter((e) => e.course.subjects.length > 0)
    .map((e) => {
      const inputs: SubjectGradeInput[] = e.course.subjects.map((s) => ({
        units: s.units,
        finalGrade: gradeMap.get(s.id) ?? null,
      }))
      return {
        courseId: e.courseId,
        courseTitle: e.course.title,
        ...certificateEligibility(inputs, e.course.passingGrade),
      }
    })
}
```

- [ ] **Step 2: Create the issuance file**

Create `lib/certificates/issue.ts`:

```ts
import { db } from '@/lib/db'
import { generateCertificateNo } from '@/lib/certificates/number'

// Idempotent auto-issue: one certificate per student per course. Reuses the
// existing row (keeping its number and date stable) or creates a new one.
export async function issueCertificate(
  userId: string,
  courseId: string,
): Promise<{ certificateNo: string; issuedAt: Date }> {
  return db.certificate.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: {},
    create: { userId, courseId, certificateNo: generateCertificateNo() },
    select: { certificateNo: true, issuedAt: true },
  })
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors (exit 0).

- [ ] **Step 4: Commit**

```bash
git add lib/certificates/queries.ts lib/certificates/issue.ts
git commit -m "feat: add certificate eligibility queries and issuance"
```

---

### Task 6: Certificate print page and route

**Files:**
- Create: `app/(student)/student/certificate/[courseId]/page.tsx`
- Create: `app/(student)/student/certificate/[courseId]/print-button.tsx`
- Modify: `app/globals.css` (append print rules at end of file)

**Interfaces:**
- Consumes: `getSession` (`@/lib/auth/session`), `db` (`@/lib/db`), `getCertificateEligibility` (Task 5), `issueCertificate` (Task 5), `Button` (`@/components/ui/button`).
- Produces: the route `/student/certificate/[courseId]`.

- [ ] **Step 1: Add print isolation CSS**

Append to the end of `app/globals.css`:

```css
/* Certificate print: isolate the certificate so page chrome (nav, buttons)
   is hidden and the certificate fills an A4 landscape sheet. */
@media print {
  @page {
    size: A4 landscape;
    margin: 0;
  }
  body * {
    visibility: hidden;
  }
  #certificate,
  #certificate * {
    visibility: visible;
  }
  #certificate {
    position: absolute;
    inset: 0;
    margin: 0;
  }
}
```

- [ ] **Step 2: Create the print button client component**

Create `app/(student)/student/certificate/[courseId]/print-button.tsx`:

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <Button onClick={() => window.print()} className="print:hidden">
      <Printer className="h-4 w-4" />
      Print / Save as PDF
    </Button>
  )
}
```

- [ ] **Step 3: Create the certificate page**

Create `app/(student)/student/certificate/[courseId]/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { getCertificateEligibility } from '@/lib/certificates/queries'
import { issueCertificate } from '@/lib/certificates/issue'
import { PrintButton } from './print-button'

export const metadata = { title: 'Certificate - AQA Student' }

type Props = { params: Promise<{ courseId: string }> }

export default async function CertificatePage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { courseId } = await params

  // Ownership: the student must be enrolled in this course.
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: session.userId, courseId } },
    select: { id: true },
  })
  if (!enrollment) redirect('/student/dashboard')

  // Recompute eligibility server-side; never trust the client.
  const result = await getCertificateEligibility(session.userId, courseId)
  if (!result || !result.eligibility.eligible) redirect('/student/dashboard')

  const [cert, user] = await Promise.all([
    issueCertificate(session.userId, courseId),
    db.user.findUnique({
      where: { id: session.userId },
      select: { firstName: true, lastName: true, displayName: true },
    }),
  ])

  const studentName =
    (user && `${user.firstName} ${user.lastName}`.trim()) ||
    user?.displayName ||
    'Student'
  const average = Math.round(result.eligibility.courseGrade as number)
  const issuedOn = cert.issuedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-zinc-100 px-4 py-10 flex flex-col items-center gap-6">
      {/* Certificate sheet */}
      <div
        id="certificate"
        className="relative w-full max-w-[1000px] aspect-[297/210] bg-white shadow-lg overflow-hidden"
      >
        {/* Border frame */}
        <div className="absolute inset-4 border-2 border-primary/70" />
        <div className="absolute inset-6 border border-primary/30" />

        <div className="relative h-full flex flex-col items-center justify-center text-center px-16 py-12">
          <Image
            src="/aqa-logo.png"
            alt="Al-Qur'an Academy"
            width={72}
            height={72}
            className="mb-4"
          />
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-primary">
            Al-Qur&apos;an Academy
          </p>

          <h1 className="mt-6 font-heading text-3xl font-bold tracking-tight text-zinc-900">
            Certificate of Completion
          </h1>

          <p className="mt-6 text-sm text-zinc-500">This certifies that</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">
            {studentName}
          </p>

          <p className="mt-4 max-w-xl text-sm text-zinc-600">
            has successfully completed{' '}
            <span className="font-semibold text-zinc-900">
              {result.courseTitle}
            </span>{' '}
            with a final average of{' '}
            <span className="font-semibold text-primary">{average}%</span>.
          </p>

          <div className="mt-10 flex w-full max-w-xl items-end justify-between text-left">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                Certificate No.
              </p>
              <p className="text-sm font-medium text-zinc-700">
                {cert.certificateNo}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                Issued
              </p>
              <p className="text-sm font-medium text-zinc-700">{issuedOn}</p>
            </div>
          </div>
        </div>
      </div>

      <PrintButton />
    </div>
  )
}
```

- [ ] **Step 4: Verify typecheck and build**

Run: `pnpm exec tsc --noEmit`
Expected: no errors (exit 0).

- [ ] **Step 5: Commit**

```bash
git add "app/(student)/student/certificate" app/globals.css
git commit -m "feat: add certificate print page and route"
```

---

### Task 7: Dashboard "Certificates" section

**Files:**
- Modify: `app/(student)/student/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getStudentCertificates`, `CertificateListItem` (Task 5); `Button`, `Link`, `Award`/`Lock` icons from `lucide-react`.

- [ ] **Step 1: Import the query and icons**

In `app/(student)/student/dashboard/page.tsx`, add these imports near the existing ones (the file already imports `Link`, `Button`, and icons from `lucide-react`):

```tsx
import { getStudentCertificates } from '@/lib/certificates/queries'
import { Award, Lock } from 'lucide-react'
```

Update the existing `lucide-react` import line to include the new icons if you prefer a single import, for example:
`import { CheckCircle2, Clock, Award, Lock } from "lucide-react";`

- [ ] **Step 2: Load certificates in the page's data fetch**

In the `Promise.all([...])` that currently destructures `[{ enrollments, ... }, recentResults, user]`, add a fourth call and binding:

```tsx
  const [
    { enrollments, schedules, announcements, pendingPurchases },
    recentResults,
    user,
    certificates,
  ] = await Promise.all([
    getStudentDashboard(session.userId),
    getStudentRecentResults(session.userId),
    db.user.findUnique({
      where: { id: session.userId },
      select: { firstName: true },
    }),
    getStudentCertificates(session.userId),
  ])
```

- [ ] **Step 3: Render the Certificates section**

Immediately after the closing `</section>` of the "My Courses" block (before the "Recent Results" block), insert:

```tsx
      {/* Certificates */}
      {certificates.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.2em]">
            Certificates
          </h2>
          <div className="space-y-2">
            {certificates.map((c) => {
              const reason = !c.allGraded
                ? `Available once all ${c.totalSubjects} subjects are graded (${c.gradedCount}/${c.totalSubjects} done)`
                : `Your average (${Math.round(c.courseGrade ?? 0)}%) is below the ${c.passingGrade}% required to pass`
              return (
                <div
                  key={c.courseId}
                  className="flex items-center justify-between gap-4 rounded-xl bg-white border border-zinc-200 shadow-sm px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-zinc-900 truncate">
                      {c.courseTitle}
                    </p>
                    {c.eligible ? (
                      <p className="text-xs text-emerald-600 mt-0.5">
                        Passed with a {Math.round(c.courseGrade ?? 0)}% average
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-400 mt-0.5">{reason}</p>
                    )}
                  </div>
                  {c.eligible ? (
                    <Button asChild size="sm" className="shrink-0">
                      <Link href={`/student/certificate/${c.courseId}`}>
                        <Award className="h-4 w-4" />
                        Download Certificate
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled
                      className="shrink-0"
                    >
                      <Lock className="h-4 w-4" />
                      Locked
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors (exit 0).

- [ ] **Step 5: Manual end-to-end verification**

Run: `pnpm dev`, then in a browser:
1. Log in as a student enrolled in a course where **every** visible subject has a final grade and the units-weighted average is `>= passingGrade`. On `/student/dashboard`, the Certificates section shows an enabled **Download Certificate** button. Click it: the certificate page renders with the student name, course title, average, a `AQA-<year>-<hex>` number, and today's date. Use the browser print dialog (or the Print button) and confirm the preview shows only the certificate, A4 landscape, no nav.
2. Log in as a student with an ungraded subject or a below-passing average: the section shows a disabled **Locked** button with the correct reason. Visit `/student/certificate/<thatCourseId>` directly and confirm you are redirected to `/student/dashboard`.

Expected: both flows behave as described.

- [ ] **Step 6: Run the full test suite and commit**

Run: `pnpm test -- --run`
Expected: PASS (all suites green).

```bash
git add "app/(student)/student/dashboard/page.tsx"
git commit -m "feat: add certificates section to student dashboard"
```

---

## Self-Review Notes

- **Spec coverage:** eligibility rule (Tasks 3, 5), weighted course grade (Task 2), cert number format (Task 4), auto-issue idempotency (Tasks 1, 5), certificate route + server-side re-check + A4 print layout (Task 6), dashboard entry point with disabled state and precise reasons (Task 7), gender-filter correctness (Task 5). Out-of-scope items (server PDF, email, admin UI, cross-course GWA) are intentionally absent.
- **Type consistency:** `SubjectGradeInput`, `CertificateEligibility`, and `certificateEligibility` are defined in Task 3 and consumed unchanged in Task 5; `getCertificateEligibility` returns `{ courseTitle, eligibility }` and is consumed that way in Task 6; `getStudentCertificates` returns `CertificateListItem` consumed in Task 7; `issueCertificate` returns `{ certificateNo, issuedAt }` consumed in Task 6.
- **No placeholders:** every code and command step is concrete.
