# Per-Lesson Assessment Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attach an assessment to a lesson so that passing it is the condition for opening the lessons that follow it in the same subject.

**Architecture:** `Assessment` gains a nullable `lessonId`; non-null makes it a gate, null keeps today's subject-level behavior untouched. A pure function in `lib/lessons/gating.ts` decides which lessons are locked from already-loaded data. Passing a gate upserts the existing `LessonCompletion` row, so progress percentage, the sidebar check, and the gate all read one source of truth. A per-course `sequentialLessons` flag controls rollout.

**Tech Stack:** Next.js App Router (server components + server actions), Prisma 7 on Postgres (Supabase), Vitest with a mocked `@/lib/db`, Tailwind, shadcn/ui, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-09-per-lesson-assessment-gating-design.md`

## Global Constraints

- Package manager is **pnpm**. Never `npm` or `yarn`.
- Never use an em dash in code, comments, copy, or commit messages. Use a plain dash.
- Never edit `app/generated/prisma/` by hand. It is a stale, unused, git-tracked leftover excluded in `tsconfig.json`. The real client is `@prisma/client` in `node_modules`.
- **Migrations cannot be applied from this session.** DB-touching Prisma commands are blocked by the sandbox classifier and `migrate dev` has no TTY. The user must run `pnpm prisma migrate dev --name <name>` in their own terminal. `pnpm prisma generate` is allowed and must be run afterwards to refresh the client.
- Never run `pnpm format` / `prettier --write` on existing files. `.prettierrc` disagrees with the house style and would produce an unrelated diff.
- Every failure mode of this feature must resolve to **open**. An unpublished gate, a null `passingScore`, or the toggle being off locks nothing.
- Unlimited retakes apply to lesson gates **only**. Subject-level quizzes and exams keep the existing one-attempt rule.
- `Assessment.maxAttempts` stays unread. Do not wire it up.
- Type check with `./node_modules/.bin/tsc --noEmit`. Lint with `pnpm lint`. Run tests with `pnpm vitest run <path>`.
- Commit messages: conventional-commit prefix, no co-author trailer, no "Generated with" line.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `lib/lessons/gating.ts` | Pure unlock rule. No DB, no Prisma imports. |
| `lib/lessons/queries.ts` | Loads what the rule needs for one student and one subject, for server actions that do not already have the data. |
| `lib/__tests__/lessons/gating.test.ts` | Unit tests for the pure rule. |
| `lib/__tests__/lessons/enforcement.test.ts` | Access-rule tests for the student actions and queries. |
| `lib/__tests__/assessments/gate-authoring.test.ts` | Publish validation, admin-only authoring, essay rejection. |

**Modified**

| File | Change |
|---|---|
| `prisma/schema.prisma` | `Assessment.lessonId`, `Course.sequentialLessons`, `Lesson.assessment`. |
| `lib/assessments/grading.ts` | Add `pickBestAttempt`. |
| `lib/assessments/publish-validation.ts` | Gate-specific publish blockers. |
| `lib/auth/capabilities.ts` | Add `isAdmin`. |
| `lib/assessments/actions.ts` | Lesson attach/detach, admin-only guard, essay rejection. |
| `lib/assessments/queries.ts` | Surface `lessonId` on admin rows. |
| `lib/student/queries.ts` | Gating in `getStudentSubject`, reveal rule in `getStudentAttempt`, `lessonId: null` grade filters. |
| `lib/teacher/queries.ts` | `lessonId: null` filter in `getSubjectGradebook`. |
| `app/(student)/student/courses/[id]/subjects/[sid]/actions.ts` | Reject mark/unmark on gated and locked lessons. |
| `app/(student)/student/courses/[id]/subjects/[sid]/assessments/actions.ts` | Retakes, locked-lesson refusal, completion write on pass. |
| `app/(student)/student/courses/[id]/subjects/[sid]/lesson-player.tsx` | Locked rows, gate inside the lesson dropdown. |
| `app/(student)/.../attempt/[attemptId]/page.tsx` | Result panel, withheld answer key on a failed gate. |
| `components/assessments/create-assessment-form.tsx`, `edit-assessment-form.tsx` | Lesson selector, admin only. |
| `app/(admin)/admin/courses/actions.ts` | `sequentialLessons` in the course schema. |
| `app/(admin)/admin/courses/[id]/edit-course-form.tsx`, `new/create-course-form.tsx` | Sequential lessons toggle. |

---

### Task 1: Schema and migration

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: nothing.
- Produces: `Assessment.lessonId: string | null`, `Assessment.lesson`, `Course.sequentialLessons: boolean`, `Lesson.assessment`. Every later task depends on these.

- [ ] **Step 1: Add `lessonId` to `Assessment`**

In `prisma/schema.prisma`, inside `model Assessment`, after the `subject` relation:

```prisma
  // Non-null makes this a lesson gate: the student must pass it before the
  // lessons ordered after this one open. Null is a subject-level quiz or exam,
  // which behaves exactly as it always has. Postgres treats NULLs as distinct,
  // so @@unique here allows any number of subject-level assessments while
  // holding a lesson to at most one gate.
  lessonId String?
  lesson   Lesson? @relation(fields: [lessonId], references: [id])
```

and at the end of the same model:

```prisma
  @@unique([lessonId])
```

- [ ] **Step 2: Add `sequentialLessons` to `Course`**

Inside `model Course`, next to `passingGrade`:

```prisma
  // Off by default. When on, lessons in this course lock behind the gating
  // assessments on the lessons before them. The toggle exists so an admin can
  // author every lesson quiz first and enable gating deliberately, instead of
  // a single publish silently locking a live batch out of lessons it had
  // already reached.
  sequentialLessons Boolean @default(false)
```

- [ ] **Step 3: Add the back-relation to `Lesson`**

Inside `model Lesson`, next to `completions`:

```prisma
  assessment Assessment?
```

- [ ] **Step 4: Ask the user to run the migration**

This session cannot apply migrations. Stop and ask the user to run, in their own terminal:

```bash
pnpm prisma migrate dev --name per_lesson_assessment_gating
```

Wait for them to confirm. Do not continue until they do.

- [ ] **Step 5: Verify the migration landed and refresh the client**

```bash
ls prisma/migrations | tail -3
pnpm prisma generate
```

Expected: a new `*_per_lesson_assessment_gating` folder exists. A success message alone is not proof; the folder is. If there is no new folder, the migration did not run.

- [ ] **Step 6: Prove the columns exist in the generated client**

```bash
./node_modules/.bin/tsc --noEmit
```

Expected: clean. Then confirm the field is really on the client:

```bash
grep -c "sequentialLessons" node_modules/.prisma/client/index.d.ts
```

Expected: a non-zero count. Do not grep `app/generated/prisma`, it is stale.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add lesson gating columns to assessment and course"
```

---

### Task 2: The pure unlock rule

**Files:**
- Create: `lib/lessons/gating.ts`
- Test: `lib/__tests__/lessons/gating.test.ts`

**Interfaces:**
- Consumes: nothing. This module imports nothing, so it can be tested with no mocks.
- Produces:
  - `type GateAssessment = { isPublished: boolean; passingScore: number | null; attemptScores: (number | null)[] }`
  - `type GatingLesson = { id: string; order: number; isCompleted: boolean; assessment: GateAssessment | null }`
  - `isLessonSatisfied(lesson: GatingLesson): boolean`
  - `computeLockedLessons(lessons: GatingLesson[], sequentialLessons: boolean): Map<string, string>` mapping a locked lesson id to the id of the first unsatisfied lesson blocking it.

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/lessons/gating.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  isLessonSatisfied,
  computeLockedLessons,
  type GatingLesson,
} from '@/lib/lessons/gating'

function lesson(over: Partial<GatingLesson> & { id: string; order: number }): GatingLesson {
  return { isCompleted: false, assessment: null, ...over }
}

const gate = (over: Partial<NonNullable<GatingLesson['assessment']>> = {}) => ({
  isPublished: true,
  passingScore: 75,
  attemptScores: [] as (number | null)[],
  ...over,
})

describe('isLessonSatisfied', () => {
  it('is satisfied when the lesson has no assessment', () => {
    expect(isLessonSatisfied(lesson({ id: 'l1', order: 1 }))).toBe(true)
  })

  it('is satisfied when the gate is unpublished', () => {
    const l = lesson({ id: 'l1', order: 1, assessment: gate({ isPublished: false }) })
    expect(isLessonSatisfied(l)).toBe(true)
  })

  it('is satisfied when the gate has no passing score', () => {
    const l = lesson({ id: 'l1', order: 1, assessment: gate({ passingScore: null }) })
    expect(isLessonSatisfied(l)).toBe(true)
  })

  it('is satisfied by an existing completion, which is the grandfather clause', () => {
    const l = lesson({ id: 'l1', order: 1, isCompleted: true, assessment: gate() })
    expect(isLessonSatisfied(l)).toBe(true)
  })

  it('is satisfied by an attempt at or above the passing score', () => {
    const l = lesson({ id: 'l1', order: 1, assessment: gate({ attemptScores: [40, 75] }) })
    expect(isLessonSatisfied(l)).toBe(true)
  })

  it('is not satisfied by attempts below the passing score', () => {
    const l = lesson({ id: 'l1', order: 1, assessment: gate({ attemptScores: [40, 74.9, null] }) })
    expect(isLessonSatisfied(l)).toBe(false)
  })
})

describe('computeLockedLessons', () => {
  const failed = lesson({ id: 'l2', order: 2, assessment: gate({ attemptScores: [10] }) })

  it('locks nothing when sequentialLessons is off', () => {
    const lessons = [lesson({ id: 'l1', order: 1 }), failed, lesson({ id: 'l3', order: 3 })]
    expect(computeLockedLessons(lessons, false).size).toBe(0)
  })

  it('never locks the first lesson', () => {
    const lessons = [lesson({ id: 'l1', order: 1, assessment: gate() })]
    expect(computeLockedLessons(lessons, true).has('l1')).toBe(false)
  })

  it('leaves the blocking lesson itself open so its quiz can be taken', () => {
    const lessons = [lesson({ id: 'l1', order: 1 }), failed, lesson({ id: 'l3', order: 3 })]
    const locked = computeLockedLessons(lessons, true)
    expect(locked.has('l2')).toBe(false)
    expect(locked.get('l3')).toBe('l2')
  })

  it('locks every lesson after the first unsatisfied one', () => {
    const lessons = [
      lesson({ id: 'l1', order: 1 }),
      failed,
      lesson({ id: 'l3', order: 3 }),
      lesson({ id: 'l4', order: 4, assessment: gate({ attemptScores: [100] }) }),
    ]
    const locked = computeLockedLessons(lessons, true)
    expect([...locked.keys()].sort()).toEqual(['l3', 'l4'])
  })

  it('lets ungated lessons between gates stay open', () => {
    const lessons = [
      lesson({ id: 'l1', order: 1, assessment: gate({ attemptScores: [90] }) }),
      lesson({ id: 'l2', order: 2 }),
      lesson({ id: 'l3', order: 3 }),
    ]
    expect(computeLockedLessons(lessons, true).size).toBe(0)
  })

  it('orders by order, not by array position', () => {
    const lessons = [lesson({ id: 'l3', order: 3 }), failed, lesson({ id: 'l1', order: 1 })]
    const locked = computeLockedLessons(lessons, true)
    expect(locked.has('l1')).toBe(false)
    expect(locked.get('l3')).toBe('l2')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run lib/__tests__/lessons/gating.test.ts`
Expected: FAIL, cannot resolve `@/lib/lessons/gating`.

- [ ] **Step 3: Write the implementation**

Create `lib/lessons/gating.ts`:

```ts
// Pure unlock rule for per-lesson assessment gating. No DB access and no
// Prisma imports, so it is unit testable and can be called from a query that
// has already loaded the data it needs.

export type GateAssessment = {
  isPublished: boolean
  passingScore: number | null
  // Every score this student has recorded on the gate. Null entries are
  // attempts awaiting grading, which never satisfy a gate.
  attemptScores: (number | null)[]
}

export type GatingLesson = {
  id: string
  order: number
  // A LessonCompletion row exists for this student. It is written both by the
  // manual "Mark as done" button and by passing a gate, which is what makes
  // students who progressed before gating existed keep their access.
  isCompleted: boolean
  assessment: GateAssessment | null
}

// Every failure mode here resolves to satisfied. A broken or half-configured
// gate must never leave a paying student unable to study.
export function isLessonSatisfied(lesson: GatingLesson): boolean {
  const gate = lesson.assessment
  if (gate == null) return true
  if (!gate.isPublished) return true
  if (gate.passingScore == null) return true
  if (lesson.isCompleted) return true
  return gate.attemptScores.some(s => s != null && s >= gate.passingScore!)
}

// Maps each locked lesson id to the id of the lesson blocking it. The first
// unsatisfied lesson stays open, because the student has to reach it to take
// the quiz that unlocks the rest.
export function computeLockedLessons(
  lessons: GatingLesson[],
  sequentialLessons: boolean,
): Map<string, string> {
  const locked = new Map<string, string>()
  if (!sequentialLessons) return locked

  const ordered = [...lessons].sort((a, b) => a.order - b.order)
  let blockedBy: string | null = null

  for (const lesson of ordered) {
    if (blockedBy != null) {
      locked.set(lesson.id, blockedBy)
      continue
    }
    if (!isLessonSatisfied(lesson)) blockedBy = lesson.id
  }

  return locked
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run lib/__tests__/lessons/gating.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/lessons/gating.ts lib/__tests__/lessons/gating.test.ts
git commit -m "feat: add pure lesson gating rule"
```

---

### Task 3: Best-attempt selection for retakes

**Files:**
- Modify: `lib/assessments/grading.ts`
- Test: `lib/__tests__/assessments/grading.test.ts` (create if absent, otherwise append a `describe` block)

**Interfaces:**
- Consumes: the existing `pickRelevantAttempt` in the same file.
- Produces: `pickBestAttempt<T extends { status: AttemptStatus; score: number | null }>(attempts: T[]): T | null`. Callers pass attempts ordered most-recent-first, matching every existing query.

- [ ] **Step 1: Write the failing tests**

Append to `lib/__tests__/assessments/grading.test.ts` (create the file with the imports below if it does not exist):

```ts
import { describe, it, expect } from 'vitest'
import { pickBestAttempt } from '@/lib/assessments/grading'

describe('pickBestAttempt', () => {
  it('returns null with no attempts', () => {
    expect(pickBestAttempt([])).toBeNull()
  })

  it('prefers the highest score, not the most recent', () => {
    const attempts = [
      { id: 'newest', status: 'GRADED' as const, score: 40 },
      { id: 'older', status: 'GRADED' as const, score: 90 },
    ]
    expect(pickBestAttempt(attempts)?.id).toBe('older')
  })

  it('keeps the most recent on a tie, since input is most-recent-first', () => {
    const attempts = [
      { id: 'newest', status: 'GRADED' as const, score: 80 },
      { id: 'older', status: 'GRADED' as const, score: 80 },
    ]
    expect(pickBestAttempt(attempts)?.id).toBe('newest')
  })

  it('ignores in-progress attempts when a scored one exists', () => {
    const attempts = [
      { id: 'live', status: 'IN_PROGRESS' as const, score: null },
      { id: 'done', status: 'GRADED' as const, score: 55 },
    ]
    expect(pickBestAttempt(attempts)?.id).toBe('done')
  })

  it('falls back to the in-progress attempt when nothing is scored', () => {
    const attempts = [{ id: 'live', status: 'IN_PROGRESS' as const, score: null }]
    expect(pickBestAttempt(attempts)?.id).toBe('live')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run lib/__tests__/assessments/grading.test.ts`
Expected: FAIL, `pickBestAttempt` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `lib/assessments/grading.ts`:

```ts
// Retakes make pickRelevantAttempt wrong for lesson gates: it prefers any
// completed attempt, so a student who failed and then passed would be shown
// the failure. This picks the best scored attempt instead, falling back to
// pickRelevantAttempt when nothing has a score yet. Used for lesson gates
// only; subject-level assessments keep pickRelevantAttempt so the gradebook
// and exam surfaces are unchanged.
export function pickBestAttempt<
  T extends { status: AttemptStatus; score: number | null },
>(attempts: T[]): T | null {
  let best: T | null = null
  for (const a of attempts) {
    if (a.status === 'IN_PROGRESS') continue
    if (a.score == null) continue
    if (best == null || a.score > best.score!) best = a
  }
  return best ?? pickRelevantAttempt(attempts)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run lib/__tests__/assessments/grading.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/assessments/grading.ts lib/__tests__/assessments/grading.test.ts
git commit -m "feat: add pickBestAttempt for gate retakes"
```

---

### Task 4: Publish validation for gates

**Files:**
- Modify: `lib/assessments/publish-validation.ts`
- Modify: `lib/assessments/actions.ts:244-280` (`publishAssessmentAction`)
- Test: `lib/__tests__/assessments/gate-authoring.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `getPublishBlockers(questions: QuestionForValidation[], gate?: GateContext): string[]` where `type GateContext = { isGate: boolean; passingScore: number | null }`. The second parameter is optional and defaults to a non-gate, so every existing call site keeps working unchanged.

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/assessments/gate-authoring.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getPublishBlockers } from '@/lib/assessments/publish-validation'

const mc = {
  type: 'MULTIPLE_CHOICE',
  options: [{ isCorrect: true }, { isCorrect: false }],
}
const essay = { type: 'ESSAY', options: [] }

describe('getPublishBlockers gate rules', () => {
  it('leaves non-gate assessments unchanged when the gate argument is omitted', () => {
    expect(getPublishBlockers([mc, essay])).toEqual([])
  })

  it('blocks a gate with no passing score', () => {
    const blockers = getPublishBlockers([mc], { isGate: true, passingScore: null })
    expect(blockers).toContain('A lesson gate must have a passing score.')
  })

  it('blocks a gate containing an essay question, naming its position', () => {
    const blockers = getPublishBlockers([mc, essay], { isGate: true, passingScore: 75 })
    expect(blockers).toContain(
      'Question 2: a lesson gate cannot contain essay questions, because it must score instantly.',
    )
  })

  it('passes a valid gate', () => {
    expect(getPublishBlockers([mc], { isGate: true, passingScore: 75 })).toEqual([])
  })

  it('still blocks an empty gate', () => {
    expect(getPublishBlockers([], { isGate: true, passingScore: 75 })).toEqual([
      'Assessment must have at least one question.',
    ])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run lib/__tests__/assessments/gate-authoring.test.ts`
Expected: FAIL, the gate blockers are not produced.

- [ ] **Step 3: Write the implementation**

Replace the contents of `lib/assessments/publish-validation.ts` with:

```ts
type QuestionForValidation = {
  type: string
  options: { isCorrect: boolean }[]
}

// A lesson gate has two rules a subject-level assessment does not: it must
// have a threshold to compare against, and it must score without a human,
// because a student is waiting on it to open the next lesson.
export type GateContext = { isGate: boolean; passingScore: number | null }

const NOT_A_GATE: GateContext = { isGate: false, passingScore: null }

export function getPublishBlockers(
  questions: QuestionForValidation[],
  gate: GateContext = NOT_A_GATE,
): string[] {
  if (questions.length === 0) return ['Assessment must have at least one question.']
  const blockers: string[] = []

  if (gate.isGate && gate.passingScore == null) {
    blockers.push('A lesson gate must have a passing score.')
  }

  questions.forEach((q, i) => {
    const num = i + 1
    if (q.type === 'MULTIPLE_CHOICE') {
      if (q.options.length < 2 || q.options.length > 6) {
        blockers.push(`Question ${num}: must have 2-6 options.`)
      }
      const correctCount = q.options.filter(o => o.isCorrect).length
      if (correctCount !== 1) {
        blockers.push(`Question ${num}: must have exactly one correct answer.`)
      }
    } else if (q.type === 'TRUE_FALSE') {
      const correctCount = q.options.filter(o => o.isCorrect).length
      if (correctCount !== 1) {
        blockers.push(`Question ${num}: must have a correct answer set.`)
      }
    } else if (q.type === 'ESSAY' && gate.isGate) {
      blockers.push(
        `Question ${num}: a lesson gate cannot contain essay questions, because it must score instantly.`,
      )
    }
  })

  return blockers
}
```

- [ ] **Step 4: Pass the gate context at the call site**

In `lib/assessments/actions.ts`, in `publishAssessmentAction`, extend the select and the call:

```ts
  const assessment = await db.assessment.findUnique({
    where: { id },
    select: {
      lessonId: true,
      passingScore: true,
      questions: {
        orderBy: { order: 'asc' },
        select: { type: true, options: { select: { isCorrect: true } } },
      },
    },
  })
  if (!assessment) return { error: 'Assessment not found.' }

  const blockers = getPublishBlockers(assessment.questions, {
    isGate: assessment.lessonId != null,
    passingScore: assessment.passingScore,
  })
```

- [ ] **Step 5: Run the tests and the type check**

Run: `pnpm vitest run lib/__tests__/assessments/gate-authoring.test.ts && ./node_modules/.bin/tsc --noEmit`
Expected: PASS and a clean type check.

- [ ] **Step 6: Commit**

```bash
git add lib/assessments/publish-validation.ts lib/assessments/actions.ts lib/__tests__/assessments/gate-authoring.test.ts
git commit -m "feat: require a passing score and reject essays on lesson gates"
```

---

### Task 5: Admin-only gate authoring

**Files:**
- Modify: `lib/auth/capabilities.ts`
- Modify: `lib/assessments/actions.ts` (`authorize`, `createAssessmentAction`, `updateAssessmentAction`, `createQuestionAction`, `updateQuestionAction`)
- Test: `lib/__tests__/assessments/gate-authoring.test.ts` (append)

**Interfaces:**
- Consumes: `GateContext` from Task 4.
- Produces:
  - `isAdmin(session: SessionLike | null): boolean` from `lib/auth/capabilities.ts`. Synchronous, no DB.
  - `authorize` in `lib/assessments/actions.ts` now returns `{ session, subjectId, basePath }` instead of `{ subjectId, basePath }`.

- [ ] **Step 1: Add `isAdmin`**

Append to `lib/auth/capabilities.ts`:

```ts
// Gate authoring is admin-only: a teacher who could edit a gate's questions or
// passing score could lock a whole batch out of a subject. Synchronous because
// the role is already on the session.
export function isAdmin(session: SessionLike | null): boolean {
  return session?.role === 'SUPER_ADMIN' || session?.role === 'ADMIN'
}
```

- [ ] **Step 2: Return the session from `authorize`**

In `lib/assessments/actions.ts`, change the helper so downstream actions can check the role. Replace its signature and return:

```ts
type SessionLike = { userId: string; role: UserRole }

async function authorize(
  formData: FormData,
): Promise<{ session: SessionLike; subjectId: string; basePath: string } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const subjectId = formData.get('subjectId')
  if (typeof subjectId !== 'string' || !subjectId)
    return { error: 'Invalid subject ID.' }

  const basePath = formData.get('basePath')
  if (typeof basePath !== 'string' || !basePath)
    return { error: 'Invalid base path.' }

  if (!(await canManageSubject(session, subjectId)))
    return { error: 'Forbidden' }

  return { session, subjectId, basePath }
}
```

Add `import type { UserRole } from '@/lib/auth/types'` and extend the capabilities import to `import { canManageSubject, isAdmin } from '@/lib/auth/capabilities'`.

- [ ] **Step 3: Add a shared lesson-field parser**

Add near `parseOptions` in the same file:

```ts
// Reads the optional "Gates lesson" field. Returns null for "no gate", or an
// error string. The admin-only check lives here because both create and update
// need exactly the same rule.
function parseLessonId(
  formData: FormData,
  session: SessionLike,
  alreadyGates: boolean,
): string | null | { error: string } {
  const raw = formData.get('lessonId')
  const lessonId = typeof raw === 'string' && raw !== '' ? raw : null
  // The second half matters as much as the first: without it a teacher could
  // edit the questions or passing score of a gate an admin already created.
  if ((lessonId != null || alreadyGates) && !isAdmin(session)) {
    return { error: 'Only an admin can manage a lesson gate.' }
  }
  return lessonId
}
```

- [ ] **Step 4: Wire it into `createAssessmentAction`**

After the `assessmentSchema.safeParse` block:

```ts
  const lessonId = parseLessonId(formData, auth.session, false)
  if (lessonId != null && typeof lessonId === 'object') return lessonId

  if (lessonId != null) {
    const lesson = await db.lesson.findFirst({
      where: { id: lessonId, subjectId },
      select: { id: true },
    })
    if (!lesson) return { error: 'Invalid lesson.' }
  }
```

Add `lessonId,` to the `db.assessment.create` `data` object, and replace the catch body with:

```ts
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { error: 'That lesson already has an assessment.' }
    }
    console.error('[createAssessment]', err)
    return { error: 'A database error occurred. Please try again.' }
  }
```

Add `import { Prisma } from '@prisma/client'` at the top of the file.

- [ ] **Step 5: Wire it into `updateAssessmentAction`**

After the `safeParse` block:

```ts
  const existing = await db.assessment.findUnique({
    where: { id },
    select: { lessonId: true, subjectId: true },
  })
  if (!existing) return { error: 'Assessment not found.' }

  const lessonId = parseLessonId(formData, auth.session, existing.lessonId != null)
  if (lessonId != null && typeof lessonId === 'object') return lessonId

  if (lessonId != null) {
    const lesson = await db.lesson.findFirst({
      where: { id: lessonId, subjectId: existing.subjectId },
      select: { id: true },
    })
    if (!lesson) return { error: 'Invalid lesson.' }

    // Attaching a lesson to an assessment that already holds an essay would
    // create a gate that cannot score without a teacher, so it is refused here
    // rather than at publish time when the admin has forgotten why.
    const essays = await db.question.findMany({
      where: { assessmentId: id, type: 'ESSAY' },
      orderBy: { order: 'asc' },
      select: { order: true },
    })
    if (essays.length > 0) {
      return {
        error:
          'Remove the essay question(s) at position ' +
          essays.map(e => e.order).join(', ') +
          ' before this assessment can gate a lesson.',
      }
    }
  }
```

Add `lessonId,` to the `db.assessment.update` `data` object, and give it the same `P2002` catch as Step 4.

- [ ] **Step 6: Reject essays on a gate in both question actions**

In `createQuestionAction` and `updateQuestionAction`, after the `questionSchema.safeParse` block:

```ts
  if (result.data.type === 'ESSAY') {
    const gate = await db.assessment.findUnique({
      where: { id: assessmentId },
      select: { lessonId: true },
    })
    if (gate?.lessonId != null) {
      return {
        error:
          'A lesson gate cannot contain essay questions, because it must score instantly.',
      }
    }
  }
```

- [ ] **Step 7: Write the failing tests**

Append to `lib/__tests__/assessments/gate-authoring.test.ts`:

```ts
import { isAdmin } from '@/lib/auth/capabilities'

describe('isAdmin', () => {
  it('is true for SUPER_ADMIN and ADMIN', () => {
    expect(isAdmin({ userId: 'u', role: 'SUPER_ADMIN' })).toBe(true)
    expect(isAdmin({ userId: 'u', role: 'ADMIN' })).toBe(true)
  })

  it('is false for a teacher, a student and no session', () => {
    expect(isAdmin({ userId: 'u', role: 'TEACHER' })).toBe(false)
    expect(isAdmin({ userId: 'u', role: 'STUDENT' })).toBe(false)
    expect(isAdmin(null)).toBe(false)
  })
})
```

- [ ] **Step 8: Run the tests, the type check and lint**

Run: `pnpm vitest run lib/__tests__/assessments/ && ./node_modules/.bin/tsc --noEmit && pnpm lint`
Expected: all pass. The type check is what proves the `authorize` return-shape change did not break its other call sites.

- [ ] **Step 9: Commit**

```bash
git add lib/auth/capabilities.ts lib/assessments/actions.ts lib/__tests__/assessments/gate-authoring.test.ts
git commit -m "feat: restrict lesson gate authoring to admins"
```

---

### Task 6: Admin authoring UI

**Files:**
- Modify: `components/assessments/create-assessment-form.tsx`
- Modify: `components/assessments/edit-assessment-form.tsx`
- Modify: `lib/assessments/queries.ts` (`AssessmentRow`, `getSubjectAssessments`, `AssessmentDetail`, `getAssessmentById`)
- Modify: `app/(admin)/admin/courses/[id]/subjects/[sid]/assessments/new/page.tsx`
- Modify: `app/(admin)/admin/courses/[id]/subjects/[sid]/assessments/[aid]/page.tsx`

**Interfaces:**
- Consumes: `isAdmin` (Task 5), the `lessonId` form field the actions now read (Task 5).
- Produces: both forms accept `lessons: Array<{ id: string; title: string; order: number; hasAssessment: boolean }>` and `canManageGates: boolean`. `AssessmentRow` and `AssessmentDetail` both gain `lessonId: string | null`.

- [ ] **Step 1: Surface `lessonId` in the admin queries**

In `lib/assessments/queries.ts`, add `lessonId: string | null` to the `AssessmentRow` and `AssessmentDetail` types, add `lessonId: true` to both `select` blocks, and add `lessonId: r.lessonId,` to the `getSubjectAssessments` mapping. `getAssessmentById` spreads the row, so it needs no mapping change.

- [ ] **Step 2: Add the selector to both forms**

Extend both form components' props with `lessons` and `canManageGates`, and render this block after the Type radio group. It is identical in both files except that the edit form adds `defaultValue={lessonId ?? ''}`:

```tsx
{canManageGates && (
  <div className="space-y-2">
    <Label htmlFor="assess-lesson">Gates lesson</Label>
    <select
      id="assess-lesson"
      name="lessonId"
      defaultValue=""
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
    >
      <option value="">None - subject-level assessment</option>
      {lessons.map(l => (
        <option key={l.id} value={l.id} disabled={l.hasAssessment}>
          {'Lesson ' + l.order + ': ' + l.title + (l.hasAssessment ? ' (already gated)' : '')}
        </option>
      ))}
    </select>
    <p className="text-xs text-muted-foreground">
      Students must pass this assessment before the lessons after it open. Gates
      cannot contain essay questions and need a passing score.
    </p>
  </div>
)}
```

- [ ] **Step 3: Feed the pages**

In both admin assessment pages, load the subject's lessons and pass them down:

```tsx
const lessons = await db.lesson.findMany({
  where: { subjectId: sid },
  orderBy: { order: 'asc' },
  select: { id: true, title: true, order: true, assessment: { select: { id: true } } },
})
```

Map to `{ id, title, order, hasAssessment: l.assessment != null }`. On the edit page, a lesson is not "already gated" if it is this assessment's own lesson, so use `l.assessment != null && l.assessment.id !== assessment.id`. Pass `canManageGates={session.role === 'SUPER_ADMIN' || session.role === 'ADMIN'}`.

The teacher pages under `app/(teacher)/teacher/subjects/[sid]/assessments/` pass `lessons={[]}` and `canManageGates={false}`, so a teacher never sees the control.

- [ ] **Step 4: Show which assessments are gates**

In the admin subject assessment list, render a "Gates lesson N" badge on any row where `lessonId != null`. In the admin lesson list, render a "Gated" badge on any lesson with an assessment. Use the existing `Badge` component with `variant="secondary"`.

- [ ] **Step 5: Verify**

Run: `./node_modules/.bin/tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add components/assessments lib/assessments/queries.ts "app/(admin)" "app/(teacher)"
git commit -m "feat: add lesson gate selector to assessment authoring"
```

---

### Task 7: Course sequential-lessons toggle

**Files:**
- Modify: `app/(admin)/admin/courses/actions.ts:31` (`courseSchema`) and both create/update actions
- Modify: `app/(admin)/admin/courses/[id]/edit-course-form.tsx`
- Modify: `app/(admin)/admin/courses/new/create-course-form.tsx`
- Create: `lib/lessons/queries.ts`
- Test: `lib/__tests__/lessons/enforcement.test.ts`

**Interfaces:**
- Consumes: `computeLockedLessons`, `GatingLesson` (Task 2).
- Produces: `countStudentsAffectedByGating(courseId: string): Promise<number>` from `lib/lessons/queries.ts`.

- [ ] **Step 1: Add the field to the course schema and actions**

In `app/(admin)/admin/courses/actions.ts`, add to `courseSchema`:

```ts
  sequentialLessons: z.boolean().default(false),
```

In both the create and update `raw` objects add `sequentialLessons: formData.get("sequentialLessons") === "on",` and add `sequentialLessons,` to both `db.course` `data` objects, destructuring it from `result.data` alongside `passingGrade`.

- [ ] **Step 2: Add the toggle to both course forms**

Next to the passing grade field:

```tsx
<label className="flex items-start gap-2 text-sm">
  <input
    type="checkbox"
    name="sequentialLessons"
    defaultChecked={course.sequentialLessons}
    className="mt-0.5 accent-primary"
  />
  <span>
    <span className="font-medium">Sequential lessons</span>
    <span className="block text-xs text-muted-foreground">
      Students must pass each lesson&apos;s assessment before the next lesson
      opens. Turn this on only once the lesson assessments are published.
    </span>
  </span>
</label>
```

The create form omits `defaultChecked`.

- [ ] **Step 3: Write the failing test for the affected-student count**

Create `lib/__tests__/lessons/enforcement.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    course: { findUnique: vi.fn() },
    enrollment: { findMany: vi.fn() },
    lessonCompletion: { findMany: vi.fn() },
    assessmentAttempt: { findMany: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import { countStudentsAffectedByGating } from '@/lib/lessons/queries'

describe('countStudentsAffectedByGating', () => {
  beforeEach(() => vi.clearAllMocks())

  it('counts only students who would have a lesson locked', async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue({
      subjects: [
        {
          lessons: [
            {
              id: 'l1',
              order: 1,
              assessment: { id: 'a1', isPublished: true, passingScore: 75 },
            },
            { id: 'l2', order: 2, assessment: null },
          ],
        },
      ],
    } as never)
    vi.mocked(db.enrollment.findMany).mockResolvedValue([
      { userId: 'passed' },
      { userId: 'stuck' },
    ] as never)
    // "passed" already marked lesson 1 done before gating existed.
    vi.mocked(db.lessonCompletion.findMany).mockResolvedValue([
      { userId: 'passed', lessonId: 'l1' },
    ] as never)
    vi.mocked(db.assessmentAttempt.findMany).mockResolvedValue([] as never)

    expect(await countStudentsAffectedByGating('course1')).toBe(1)
  })

  it('returns 0 when the course has no published gates', async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue({
      subjects: [{ lessons: [{ id: 'l1', order: 1, assessment: null }] }],
    } as never)
    vi.mocked(db.enrollment.findMany).mockResolvedValue([{ userId: 'u1' }] as never)
    vi.mocked(db.lessonCompletion.findMany).mockResolvedValue([] as never)
    vi.mocked(db.assessmentAttempt.findMany).mockResolvedValue([] as never)

    expect(await countStudentsAffectedByGating('course1')).toBe(0)
  })
})
```

- [ ] **Step 4: Run it to verify it fails**

Run: `pnpm vitest run lib/__tests__/lessons/enforcement.test.ts`
Expected: FAIL, cannot resolve `@/lib/lessons/queries`.

- [ ] **Step 5: Write the implementation**

Create `lib/lessons/queries.ts`:

```ts
import { db } from '@/lib/db'
import { ACTIVE_ENROLLMENT } from '@/lib/enrollments/active'
import { computeLockedLessons, type GatingLesson } from '@/lib/lessons/gating'

// How many currently enrolled students would have at least one lesson locked
// if gating were switched on for this course right now. Shown in the admin
// confirmation so the rollout failure mode - throwing a live batch back to
// lesson one - is visible before it happens rather than through support
// messages.
export async function countStudentsAffectedByGating(courseId: string): Promise<number> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      subjects: {
        select: {
          lessons: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              order: true,
              assessment: {
                select: { id: true, isPublished: true, passingScore: true },
              },
            },
          },
        },
      },
    },
  })
  if (!course) return 0

  const enrollments = await db.enrollment.findMany({
    where: { courseId, ...ACTIVE_ENROLLMENT },
    select: { userId: true },
  })
  const userIds = enrollments.map(e => e.userId)
  if (userIds.length === 0) return 0

  const lessonIds = course.subjects.flatMap(s => s.lessons.map(l => l.id))
  const assessmentIds = course.subjects.flatMap(s =>
    s.lessons.flatMap(l => (l.assessment ? [l.assessment.id] : [])),
  )

  const [completions, attempts] = await Promise.all([
    lessonIds.length > 0
      ? db.lessonCompletion.findMany({
          where: { userId: { in: userIds }, lessonId: { in: lessonIds } },
          select: { userId: true, lessonId: true },
        })
      : Promise.resolve([]),
    assessmentIds.length > 0
      ? db.assessmentAttempt.findMany({
          where: { userId: { in: userIds }, assessmentId: { in: assessmentIds } },
          select: { userId: true, assessmentId: true, score: true },
        })
      : Promise.resolve([]),
  ])

  const completedBy = new Set(completions.map(c => c.userId + ':' + c.lessonId))
  const scoresBy = new Map<string, (number | null)[]>()
  for (const a of attempts) {
    const key = a.userId + ':' + a.assessmentId
    scoresBy.set(key, [...(scoresBy.get(key) ?? []), a.score])
  }

  let affected = 0
  for (const userId of userIds) {
    const locked = course.subjects.some(subject => {
      const lessons: GatingLesson[] = subject.lessons.map(l => ({
        id: l.id,
        order: l.order,
        isCompleted: completedBy.has(userId + ':' + l.id),
        assessment: l.assessment
          ? {
              isPublished: l.assessment.isPublished,
              passingScore: l.assessment.passingScore,
              attemptScores: scoresBy.get(userId + ':' + l.assessment.id) ?? [],
            }
          : null,
      }))
      return computeLockedLessons(lessons, true).size > 0
    })
    if (locked) affected += 1
  }

  return affected
}
```

- [ ] **Step 6: Show the count in the edit form**

The edit course page calls `countStudentsAffectedByGating(course.id)` and passes it to the form. When the checkbox is being turned on (unchecked in `defaultChecked` but checked now) and the count is above zero, the form shows an inline warning before submit and requires a confirm checkbox:

```tsx
{turningOn && affectedCount > 0 && (
  <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
    {affectedCount} enrolled student{affectedCount === 1 ? '' : 's'} would have at
    least one lesson locked immediately. Students who already completed a gated
    lesson keep their access.
  </p>
)}
```

Track `turningOn` with `useState` seeded from the checkbox's `onChange`.

- [ ] **Step 7: Run the tests, type check and lint**

Run: `pnpm vitest run lib/__tests__/lessons/ && ./node_modules/.bin/tsc --noEmit && pnpm lint`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add lib/lessons/queries.ts lib/__tests__/lessons/enforcement.test.ts "app/(admin)/admin/courses"
git commit -m "feat: add sequential lessons toggle with affected-student warning"
```

---

### Task 8: Gating in the student subject query

**Files:**
- Modify: `lib/student/queries.ts` (`StudentLesson`, `StudentSubject`, `getStudentSubject`)
- Test: `lib/__tests__/lessons/enforcement.test.ts` (append)

**Interfaces:**
- Consumes: `computeLockedLessons`, `GatingLesson` (Task 2), `pickBestAttempt` (Task 3).
- Produces: `StudentLesson` gains `isLocked: boolean`, `lockedReason: string | null`, and `assessment: StudentAssessment | null`. `StudentSubject.assessments` now holds subject-level assessments only.

- [ ] **Step 1: Write the failing test**

Append to `lib/__tests__/lessons/enforcement.test.ts`. Add `subject: { findUnique: vi.fn() }`, `user: { findUnique: vi.fn() }`, `batchLessonContent: { findMany: vi.fn() }` and `batchRecording: { findMany: vi.fn() }` to the `vi.mock` block at the top of the file, plus `enrollment.findUnique`.

```ts
import { getStudentSubject } from '@/lib/student/queries'

describe('getStudentSubject gating', () => {
  beforeEach(() => vi.clearAllMocks())

  const subject = {
    id: 'sub1',
    courseId: 'course1',
    title: 'Arabic',
    description: null,
    gender: null,
    course: { title: 'Marhala 1', sequentialLessons: true },
    schedules: [],
    lessons: [
      { id: 'l1', title: 'Alphabet', description: null, order: 1 },
      { id: 'l2', title: 'Vowels', description: null, order: 2 },
    ],
    assessments: [
      {
        id: 'a1',
        title: 'Alphabet Check',
        type: 'QUIZ',
        durationMins: null,
        passingScore: 75,
        lessonId: 'l1',
        _count: { questions: 3 },
        attempts: [{ id: 'at1', status: 'GRADED', score: 20 }],
      },
    ],
  }

  it('locks lesson 2 and strips its media URLs from the payload', async () => {
    vi.mocked(db.subject.findUnique).mockResolvedValue(subject as never)
    vi.mocked(db.user.findUnique).mockResolvedValue({ gender: null } as never)
    vi.mocked(db.enrollment.findUnique).mockResolvedValue({
      id: 'e1',
      batchId: 'b1',
    } as never)
    vi.mocked(db.lessonCompletion.findMany).mockResolvedValue([] as never)
    vi.mocked(db.batchLessonContent.findMany).mockResolvedValue([
      {
        lessonId: 'l2',
        materialUrl: 'https://drive.google.com/secret',
        videoUrl: 'https://drive.google.com/video',
        audioUrl: null,
        pptUrl: null,
      },
    ] as never)
    vi.mocked(db.batchRecording.findMany).mockResolvedValue([] as never)

    const result = await getStudentSubject('student1', 'sub1')

    const l2 = result!.lessons.find(l => l.id === 'l2')!
    expect(l2.isLocked).toBe(true)
    // The real leak would be here, not in the UI: a hidden row whose Drive
    // links are still in the server-rendered payload is readable from source.
    expect(l2.materialUrl).toBeNull()
    expect(l2.videoUrl).toBeNull()
    expect(l2.assessment).toBeNull()
    expect(l2.lockedReason).toBe('Pass the Lesson 1 quiz to unlock.')
  })

  it('leaves the gating lesson itself open', async () => {
    vi.mocked(db.subject.findUnique).mockResolvedValue(subject as never)
    vi.mocked(db.user.findUnique).mockResolvedValue({ gender: null } as never)
    vi.mocked(db.enrollment.findUnique).mockResolvedValue({ id: 'e1', batchId: null } as never)
    vi.mocked(db.lessonCompletion.findMany).mockResolvedValue([] as never)
    vi.mocked(db.batchLessonContent.findMany).mockResolvedValue([] as never)
    vi.mocked(db.batchRecording.findMany).mockResolvedValue([] as never)

    const result = await getStudentSubject('student1', 'sub1')

    const l1 = result!.lessons.find(l => l.id === 'l1')!
    expect(l1.isLocked).toBe(false)
    expect(l1.assessment?.id).toBe('a1')
    // Gates live inside their lesson, not in the flat subject-level list.
    expect(result!.assessments).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run lib/__tests__/lessons/enforcement.test.ts`
Expected: FAIL, `isLocked` is undefined.

- [ ] **Step 3: Extend the types**

In `lib/student/queries.ts`:

```ts
export type StudentLesson = {
  id: string
  title: string
  description: string | null
  order: number
  materialUrl: string | null
  videoUrl: string | null
  audioUrl: string | null
  pptUrl: string | null
  isCompleted: boolean
  // True when an earlier lesson's gate has not been passed. A locked lesson
  // carries no media URLs and no assessment: the lock is a server-side content
  // decision, and the UI only reflects it.
  isLocked: boolean
  lockedReason: string | null
  // The gate for this lesson, if it has one. Null when the lesson is locked.
  assessment: StudentAssessment | null
}
```

Move the `StudentAssessment` type declaration above `StudentLesson` so it is in scope.

- [ ] **Step 4: Extend the query**

In `getStudentSubject`, add `sequentialLessons: true` to the `course` select, and `lessonId: true` to the `assessments` select. Then replace the return-building block:

```ts
  const completedSet = new Set(completions.map(c => c.lessonId))
  const batchContentMap = new Map(batchContents.map(bc => [bc.lessonId, bc]))

  const toStudentAssessment = (a: (typeof subject.assessments)[number]): StudentAssessment => {
    const attempt = a.lessonId != null
      ? pickBestAttempt(a.attempts)
      : pickRelevantAttempt(a.attempts)
    return {
      id: a.id,
      title: a.title,
      type: a.type,
      durationMins: a.durationMins,
      passingScore: a.passingScore,
      questionCount: a._count.questions,
      attempt: attempt
        ? { id: attempt.id, status: attempt.status, score: attempt.score }
        : null,
    }
  }

  const gateByLessonId = new Map(
    subject.assessments.filter(a => a.lessonId != null).map(a => [a.lessonId!, a]),
  )

  const lockedLessons = computeLockedLessons(
    subject.lessons.map(l => {
      const gate = gateByLessonId.get(l.id)
      return {
        id: l.id,
        order: l.order,
        isCompleted: completedSet.has(l.id),
        assessment: gate
          ? {
              // Only published gates reach here; the query filters on it.
              isPublished: true,
              passingScore: gate.passingScore,
              attemptScores: gate.attempts.map(at => at.score),
            }
          : null,
      }
    }),
    subject.course.sequentialLessons,
  )

  const lessonTitleById = new Map(subject.lessons.map(l => [l.id, l]))

  return {
    id: subject.id,
    courseId: subject.courseId,
    title: subject.title,
    description: subject.description,
    course: subject.course,
    schedules: subject.schedules,
    lessons: subject.lessons.map(l => {
      const blockingId = lockedLessons.get(l.id)
      const isLocked = blockingId != null
      const content = isLocked ? undefined : batchContentMap.get(l.id)
      const gate = gateByLessonId.get(l.id)
      const blocking = blockingId != null ? lessonTitleById.get(blockingId) : null
      return {
        id: l.id,
        title: l.title,
        description: l.description,
        order: l.order,
        materialUrl: content?.materialUrl ?? null,
        videoUrl: content?.videoUrl ?? null,
        audioUrl: content?.audioUrl ?? null,
        pptUrl: content?.pptUrl ?? null,
        isCompleted: completedSet.has(l.id),
        isLocked,
        lockedReason: blocking
          ? 'Pass the Lesson ' + blocking.order + ' quiz to unlock.'
          : null,
        assessment: isLocked || !gate ? null : toStudentAssessment(gate),
      }
    }),
    // Gates render inside their lesson, so the flat list keeps subject-level
    // quizzes and exams only.
    assessments: subject.assessments.filter(a => a.lessonId == null).map(toStudentAssessment),
    recordings,
  }
```

Add `computeLockedLessons` and `pickBestAttempt` to the imports at the top of the file.

- [ ] **Step 5: Run the tests, type check and lint**

Run: `pnpm vitest run lib/__tests__ && ./node_modules/.bin/tsc --noEmit && pnpm lint`
Expected: all pass. Running the whole test directory here is deliberate: this change alters a type consumed across the student surface.

- [ ] **Step 6: Commit**

```bash
git add lib/student/queries.ts lib/__tests__/lessons/enforcement.test.ts
git commit -m "feat: lock gated lessons and strip their media from the payload"
```

---

### Task 9: Enforcement in the student server actions

**Files:**
- Modify: `app/(student)/student/courses/[id]/subjects/[sid]/actions.ts`
- Modify: `lib/lessons/queries.ts`
- Test: `lib/__tests__/lessons/enforcement.test.ts` (append)

**Interfaces:**
- Consumes: `computeLockedLessons` (Task 2).
- Produces: `getLessonGateState(userId: string, lessonId: string): Promise<{ isLocked: boolean; hasGate: boolean } | null>` from `lib/lessons/queries.ts`. Returns null when the lesson does not exist.

- [ ] **Step 1: Write the failing tests**

Append to `lib/__tests__/lessons/enforcement.test.ts`:

```ts
import { markLessonDoneAction, unmarkLessonDoneAction } from '@/app/(student)/student/courses/[id]/subjects/[sid]/actions'

function lessonForm(): FormData {
  const fd = new FormData()
  fd.set('lessonId', 'l2')
  fd.set('courseId', 'course1')
  fd.set('subjectId', 'sub1')
  return fd
}

describe('manual completion is refused where a gate governs the lesson', () => {
  it('rejects marking a locked lesson done', async () => {
    // ...mock getSession + isActiveStudent + enrollment as enrolled, and
    // getLessonGateState to report { isLocked: true, hasGate: false }
    const result = await markLessonDoneAction({ error: null }, lessonForm())
    expect(result.error).toBe('This lesson is locked.')
    expect(db.lessonCompletion.upsert).not.toHaveBeenCalled()
  })

  it('rejects marking a gated lesson done, since passing is the only route', async () => {
    const result = await markLessonDoneAction({ error: null }, lessonForm())
    expect(result.error).toBe("Pass this lesson's assessment to complete it.")
    expect(db.lessonCompletion.upsert).not.toHaveBeenCalled()
  })

  it('rejects unmarking a gated lesson, which would re-lock later lessons', async () => {
    const result = await unmarkLessonDoneAction({ error: null }, lessonForm())
    expect(result.error).toBe("Pass this lesson's assessment to complete it.")
    expect(db.lessonCompletion.deleteMany).not.toHaveBeenCalled()
  })
})
```

Mock `@/lib/auth/session` and `@/lib/auth/capabilities` alongside `@/lib/db`, following the pattern in `lib/__tests__/subjects/enforcement.test.ts`.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run lib/__tests__/lessons/enforcement.test.ts`
Expected: FAIL, both actions currently succeed.

- [ ] **Step 3: Add the gate-state query**

Append to `lib/lessons/queries.ts`:

```ts
// Gate state for one lesson and one student, for server actions that do not
// already have the subject loaded. getStudentSubject computes the same thing
// from data it has already fetched rather than calling this.
export async function getLessonGateState(
  userId: string,
  lessonId: string,
): Promise<{ isLocked: boolean; hasGate: boolean } | null> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      subjectId: true,
      assessment: { select: { isPublished: true } },
      subject: { select: { course: { select: { sequentialLessons: true } } } },
    },
  })
  if (!lesson) return null

  const hasGate = lesson.assessment?.isPublished === true
  if (!lesson.subject.course.sequentialLessons) return { isLocked: false, hasGate }

  const lessons = await db.lesson.findMany({
    where: { subjectId: lesson.subjectId },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      order: true,
      assessment: { select: { id: true, isPublished: true, passingScore: true } },
    },
  })

  const [completions, attempts] = await Promise.all([
    db.lessonCompletion.findMany({
      where: { userId, lessonId: { in: lessons.map(l => l.id) } },
      select: { lessonId: true },
    }),
    db.assessmentAttempt.findMany({
      where: {
        userId,
        assessmentId: {
          in: lessons.flatMap(l => (l.assessment ? [l.assessment.id] : [])),
        },
      },
      select: { assessmentId: true, score: true },
    }),
  ])

  const completed = new Set(completions.map(c => c.lessonId))
  const scoresBy = new Map<string, (number | null)[]>()
  for (const a of attempts) {
    scoresBy.set(a.assessmentId, [...(scoresBy.get(a.assessmentId) ?? []), a.score])
  }

  const locked = computeLockedLessons(
    lessons.map(l => ({
      id: l.id,
      order: l.order,
      isCompleted: completed.has(l.id),
      assessment: l.assessment
        ? {
            isPublished: l.assessment.isPublished,
            passingScore: l.assessment.passingScore,
            attemptScores: scoresBy.get(l.assessment.id) ?? [],
          }
        : null,
    })),
    true,
  )

  return { isLocked: locked.has(lessonId), hasGate }
}
```

- [ ] **Step 4: Enforce in both completion actions**

In `app/(student)/student/courses/[id]/subjects/[sid]/actions.ts`, in `markLessonDoneAction`, replace the `db.lesson.findFirst` existence check with:

```ts
  const lesson = await db.lesson.findFirst({
    where: { id: lessonId, subject: { courseId } },
    select: { id: true },
  })
  if (!lesson) return { error: 'Invalid lesson.' }

  const gateState = await getLessonGateState(session.userId, lessonId)
  if (gateState == null) return { error: 'Invalid lesson.' }
  if (gateState.isLocked) return { error: 'This lesson is locked.' }
  // Where a gate exists, passing it is the only way to become done. Two routes
  // to "done" would let progress and unlock state disagree.
  if (gateState.hasGate) {
    return { error: "Pass this lesson's assessment to complete it." }
  }
```

In `unmarkLessonDoneAction`, before the `deleteMany`:

```ts
  const gateState = await getLessonGateState(session.userId, lessonId)
  // Un-ticking a gated lesson would re-lock everything after it.
  if (gateState?.hasGate) {
    return { error: "Pass this lesson's assessment to complete it." }
  }
```

Add `import { getLessonGateState } from '@/lib/lessons/queries'` to the file.

- [ ] **Step 5: Run the tests, type check and lint**

Run: `pnpm vitest run lib/__tests__ && ./node_modules/.bin/tsc --noEmit && pnpm lint`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add lib/lessons/queries.ts "app/(student)/student/courses/[id]/subjects/[sid]/actions.ts" lib/__tests__/lessons/enforcement.test.ts
git commit -m "feat: refuse manual completion on gated and locked lessons"
```

---

### Task 10: Retakes and the locked-lesson refusal

**Files:**
- Modify: `app/(student)/student/courses/[id]/subjects/[sid]/assessments/actions.ts` (`startAttemptAction`)
- Modify: `lib/student/queries.ts` (`getStudentAssessmentLaunch`)
- Test: `lib/__tests__/lessons/enforcement.test.ts` (append)

**Interfaces:**
- Consumes: `getLessonGateState` (Task 9).
- Produces: no new exports. `startAttemptAction` behavior changes for gates only.

- [ ] **Step 1: Write the failing tests**

Append to `lib/__tests__/lessons/enforcement.test.ts`:

```ts
describe('startAttemptAction retakes', () => {
  it('creates a new attempt after a failed gate attempt', async () => {
    // assessment.lessonId = 'l1', passingScore 75; existing attempt GRADED score 20
    await startAttemptAction({ error: null }, startForm())
    expect(db.assessmentAttempt.create).toHaveBeenCalled()
  })

  it('does NOT create a second attempt on a failed subject-level assessment', async () => {
    // assessment.lessonId = null; existing attempt GRADED score 20
    // This is the regression guard for the existing exam flow.
    await startAttemptAction({ error: null }, startForm())
    expect(db.assessmentAttempt.create).not.toHaveBeenCalled()
  })

  it('does not create another attempt once the gate is passed', async () => {
    // assessment.lessonId = 'l1', passingScore 75; existing attempt GRADED score 90
    await startAttemptAction({ error: null }, startForm())
    expect(db.assessmentAttempt.create).not.toHaveBeenCalled()
  })

  it('refuses to start a gate whose lesson is locked', async () => {
    const result = await startAttemptAction({ error: null }, startForm())
    expect(result.error).toBe('Assessment is not available.')
    expect(db.assessmentAttempt.create).not.toHaveBeenCalled()
  })
})
```

`startForm()` builds a `FormData` with `assessmentId`, `courseId` and `subjectId`. `redirect` from `next/navigation` throws in Next, so mock it with `vi.mock('next/navigation', () => ({ redirect: vi.fn() }))` and assert on the create call rather than the return value.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run lib/__tests__/lessons/enforcement.test.ts`
Expected: FAIL, no new attempt is created after a failure.

- [ ] **Step 3: Implement**

In `startAttemptAction`, extend the assessment select to `select: { id: true, lessonId: true, passingScore: true, subject: { select: { gender: true } } }`.

After the enrollment check, add the locked refusal:

```ts
  if (assessment.lessonId != null) {
    const gateState = await getLessonGateState(session.userId, assessment.lessonId)
    if (gateState?.isLocked) return { error: 'Assessment is not available.' }
  }
```

Then replace the `existing` block:

```ts
  const attempts = await db.assessmentAttempt.findMany({
    where: { assessmentId: aid, userId: session.userId },
    orderBy: { startedAt: 'desc' },
    select: { id: true, status: true, score: true },
  })

  const inProgress = attempts.find(a => a.status === 'IN_PROGRESS')
  if (inProgress) redirect(attemptPath(courseId, subjectId, aid, inProgress.id))

  const completed = attempts.filter(a => a.status !== 'IN_PROGRESS')
  if (completed.length > 0) {
    // Subject-level assessments keep the one-attempt rule. Only lesson gates
    // retake, because a gate that cannot be retaken locks a student out of the
    // rest of the subject permanently.
    if (assessment.lessonId == null) {
      redirect(attemptPath(courseId, subjectId, aid, completed[0].id))
    }
    const passed =
      assessment.passingScore != null &&
      completed.find(a => a.score != null && a.score >= assessment.passingScore!)
    if (passed) redirect(attemptPath(courseId, subjectId, aid, passed.id))
  }

  const created = await db.assessmentAttempt.create({
    data: { assessmentId: aid, userId: session.userId, status: 'IN_PROGRESS' },
    select: { id: true },
  })

  redirect(attemptPath(courseId, subjectId, aid, created.id))
```

Add `import { getLessonGateState } from '@/lib/lessons/queries'`.

- [ ] **Step 4: Close the launch page too**

In `getStudentAssessmentLaunch` in `lib/student/queries.ts`, add `lessonId: true` to the select, and after the enrollment check:

```ts
  // The direct URL has to be closed as well as the sidebar link.
  if (assessment.lessonId != null) {
    const gateState = await getLessonGateState(userId, assessment.lessonId)
    if (gateState?.isLocked) return null
  }
```

- [ ] **Step 5: Run the tests, type check and lint**

Run: `pnpm vitest run lib/__tests__ && ./node_modules/.bin/tsc --noEmit && pnpm lint`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add "app/(student)/student/courses/[id]/subjects/[sid]/assessments/actions.ts" lib/student/queries.ts lib/__tests__/lessons/enforcement.test.ts
git commit -m "feat: allow unlimited retakes on lesson gates only"
```

---

### Task 11: Write the completion on passing

**Files:**
- Modify: `app/(student)/student/courses/[id]/subjects/[sid]/assessments/actions.ts` (`submitAttemptAction`)
- Test: `lib/__tests__/lessons/enforcement.test.ts` (append)

**Interfaces:**
- Consumes: nothing new.
- Produces: no new exports.

- [ ] **Step 1: Write the failing tests**

Append to `lib/__tests__/lessons/enforcement.test.ts`:

```ts
describe('submitAttemptAction writes the pass', () => {
  it('upserts a LessonCompletion when a gate is passed', async () => {
    // assessment.lessonId = 'l1', passingScore = 75; answers score 100
    await submitAttemptAction({ error: null }, submitForm())
    expect(tx.lessonCompletion.upsert).toHaveBeenCalledWith({
      where: { userId_lessonId: { userId: 'student1', lessonId: 'l1' } },
      create: { userId: 'student1', lessonId: 'l1' },
      update: {},
    })
  })

  it('does not write a completion when the gate is failed', async () => {
    // same, but answers score 0
    await submitAttemptAction({ error: null }, submitForm())
    expect(tx.lessonCompletion.upsert).not.toHaveBeenCalled()
  })

  it('does not write a completion for a subject-level assessment', async () => {
    // assessment.lessonId = null; answers score 100
    await submitAttemptAction({ error: null }, submitForm())
    expect(tx.lessonCompletion.upsert).not.toHaveBeenCalled()
  })
})
```

Mock `db.$transaction` as `vi.fn(async (fn) => fn(tx))` where `tx` is an object of `vi.fn()`s covering `assessmentAttempt.updateMany` (returning `{ count: 1 }`), `studentAnswer.createMany`, and `lessonCompletion.upsert`.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run lib/__tests__/lessons/enforcement.test.ts`
Expected: FAIL, `lessonCompletion.upsert` is never called.

- [ ] **Step 3: Implement**

In `submitAttemptAction`, add `lessonId: true, passingScore: true,` to the nested `assessment` select. Then inside the existing `db.$transaction` callback, after the `studentAnswer.createMany` call:

```ts
      // Passing a gate is what marks the lesson done, so the same
      // LessonCompletion row the manual button writes is written here. Keeping
      // it in this transaction means a student is never scored as passing
      // without the lesson opening. The upsert is idempotent, so the concurrent
      // -submit guard above needs no change.
      const { lessonId, passingScore } = attempt.assessment
      if (
        lessonId != null &&
        passingScore != null &&
        scored.score != null &&
        scored.score >= passingScore
      ) {
        await tx.lessonCompletion.upsert({
          where: { userId_lessonId: { userId: session.userId, lessonId } },
          create: { userId: session.userId, lessonId },
          update: {},
        })
      }
```

Then add the course path to the revalidation list, since progress on the course page changes too:

```ts
  revalidatePath('/student/courses/' + courseId)
```

- [ ] **Step 4: Run the tests, type check and lint**

Run: `pnpm vitest run lib/__tests__ && ./node_modules/.bin/tsc --noEmit && pnpm lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add "app/(student)/student/courses/[id]/subjects/[sid]/assessments/actions.ts" lib/__tests__/lessons/enforcement.test.ts
git commit -m "feat: mark a lesson complete when its gate is passed"
```

---

### Task 12: Grade isolation

**Files:**
- Modify: `lib/student/queries.ts` (`getStudentCourse`, `getStudentRecentResults`)
- Modify: `lib/teacher/queries.ts` (`getSubjectGradebook`)
- Test: `lib/__tests__/lessons/enforcement.test.ts` (append)

**Interfaces:**
- Consumes: nothing new.
- Produces: no new exports. Three `where` clauses gain `lessonId: null`.

- [ ] **Step 1: Write the failing test**

Append to `lib/__tests__/lessons/enforcement.test.ts`:

```ts
describe('grade isolation', () => {
  it('excludes lesson gates from the subject average query', async () => {
    vi.mocked(db.enrollment.findUnique).mockResolvedValue({ id: 'e1' } as never)
    vi.mocked(db.course.findUnique).mockResolvedValue({
      id: 'course1',
      title: 'Marhala 1',
      imageUrl: null,
      meetLink: null,
      subjects: [],
    } as never)
    vi.mocked(db.user.findUnique).mockResolvedValue({ gender: null } as never)

    await getStudentCourse('student1', 'course1')

    // Asserting on the query is the point: a gate must never reach
    // weightedSubjectGrade, or every student's grade shifts silently.
    const call = vi.mocked(db.course.findUnique).mock.calls[0][0] as never
    const assessmentWhere =
      // @ts-expect-error - reaching into the query shape on purpose
      call.select.subjects.select.assessments.where
    expect(assessmentWhere).toEqual({ isPublished: true, lessonId: null })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run lib/__tests__/lessons/enforcement.test.ts`
Expected: FAIL, the where clause is `{ isPublished: true }`.

- [ ] **Step 3: Implement all three filters**

In `lib/student/queries.ts`, `getStudentCourse`:

```ts
            assessments: {
              // Lesson gates are checkpoints, not graded work. Ten of them at
              // the default weight would drown out the subject exam and shift
              // every student's grade, course grade, GWA and certificate
              // eligibility.
              where: { isPublished: true, lessonId: null },
```

In `lib/student/queries.ts`, `getStudentRecentResults`, inside the `assessment` filter:

```ts
      assessment: {
        isPublished: true,
        // Keep the dashboard about graded work rather than flooding it with
        // lesson checkpoints.
        lessonId: null,
        subject: { ...subjectGenderFilter(userGender), course: { ...ACTIVE_COURSE } },
      },
```

In `lib/teacher/queries.ts`, `getSubjectGradebook`:

```ts
      assessments: {
        where: { lessonId: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true, title: true, weight: true },
      },
```

- [ ] **Step 4: Run the full test suite, type check and lint**

Run: `pnpm vitest run && ./node_modules/.bin/tsc --noEmit && pnpm lint`
Expected: all pass. The existing grade tests under `lib/__tests__/grades/` must still be green; they are the real proof that nothing shifted.

- [ ] **Step 5: Commit**

```bash
git add lib/student/queries.ts lib/teacher/queries.ts lib/__tests__/lessons/enforcement.test.ts
git commit -m "feat: exclude lesson gates from grades and recent results"
```

---

### Task 13: Locked lessons and in-lesson gates in the player

**Files:**
- Modify: `app/(student)/student/courses/[id]/subjects/[sid]/lesson-player.tsx`

**Interfaces:**
- Consumes: `StudentLesson.isLocked`, `.lockedReason`, `.assessment` (Task 8).
- Produces: no new exports.

- [ ] **Step 1: Render a locked row**

Inside the `lessons.map`, before the existing row markup, branch on `lesson.isLocked`. A locked row is not a button, does not toggle, and shows no chevron:

```tsx
if (lesson.isLocked) {
  return (
    <li key={lesson.id}>
      <div
        aria-disabled="true"
        aria-label={lesson.title + '. Locked. ' + (lesson.lockedReason ?? '')}
        className="w-full flex items-center gap-3 px-4 py-3 opacity-60"
      >
        <span className="flex-none w-5 h-5 rounded-full border border-muted-foreground flex items-center justify-center">
          <Lock className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-muted-foreground line-clamp-2">
            {lesson.title}
          </span>
          {lesson.lockedReason && (
            <span className="block text-[11px] text-muted-foreground">
              {lesson.lockedReason}
            </span>
          )}
        </span>
      </div>
    </li>
  )
}
```

Import `Lock` from `lucide-react`.

- [ ] **Step 2: Render the gate inside the lesson dropdown**

Inside the expanded content, before the material links, render the lesson's own assessment with primary emphasis. It is the thing that moves the student forward, so it must not read as one more grey row:

```tsx
{lesson.assessment && (
  <Link
    href={`/student/courses/${courseId}/subjects/${subjectId}/assessments/${lesson.assessment.id}`}
    className="flex items-center gap-2.5 px-3 py-5 text-xs font-semibold text-primary bg-primary/5 transition-colors hover:bg-primary/10"
  >
    <ClipboardList className="flex-none w-4 h-4" aria-hidden="true" />
    <span className="flex-1">{lesson.assessment.title}</span>
    <span className={'flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold ' + gateStatus(lesson.assessment).className}>
      {gateStatus(lesson.assessment).label}
    </span>
  </Link>
)}
```

- [ ] **Step 3: Add the gate status helper**

Next to the existing `assessmentStatus`, add one that never produces a dead end:

```tsx
// A gate's status differs from a subject assessment's: a failed gate must
// invite a retake rather than showing a final score.
function gateStatus(a: StudentAssessment): { label: string; className: string } {
  if (a.attempt == null) return { label: 'Start Quiz', className: 'bg-primary/10 text-primary' }
  if (a.attempt.status === 'IN_PROGRESS') return { label: 'Resume', className: 'bg-amber-100 text-amber-700' }
  if (a.attempt.score == null) return { label: 'Pending', className: 'bg-amber-100 text-amber-700' }
  const passed = a.passingScore != null && a.attempt.score >= a.passingScore
  return passed
    ? { label: Math.round(a.attempt.score) + '%', className: 'bg-emerald-100 text-emerald-700' }
    : { label: Math.round(a.attempt.score) + '% - Retake', className: 'bg-red-100 text-red-700' }
}
```

- [ ] **Step 4: Hide the manual done button on gated lessons**

Both `LessonDoneButton` render sites become conditional on `lesson.assessment == null`, matching the server-side rejection from Task 9. Leaving a button that always errors would be worse than removing it.

- [ ] **Step 5: Update the empty-materials fallback**

The `!lesson.materialUrl && !lesson.pptUrl && ...` condition must also require `!lesson.assessment`, otherwise a lesson with only a gate claims to have no materials.

- [ ] **Step 6: Verify**

Run: `./node_modules/.bin/tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add "app/(student)/student/courses/[id]/subjects/[sid]/lesson-player.tsx"
git commit -m "feat: show locked lessons and gates in the lesson player"
```

---

### Task 14: Result panel and withheld answer key

**Files:**
- Modify: `lib/student/queries.ts` (`AttemptOption`, `StudentAttempt`, `getStudentAttempt`)
- Modify: `app/(student)/student/courses/[id]/subjects/[sid]/assessments/[aid]/attempt/[attemptId]/page.tsx`
- Test: `lib/__tests__/lessons/enforcement.test.ts` (append)

**Interfaces:**
- Consumes: nothing new.
- Produces: `AttemptOption.isCorrect` becomes `boolean | null`, where null means withheld. `StudentAttempt` gains `isGate: boolean` and `passed: boolean`.

- [ ] **Step 1: Write the failing test**

Append to `lib/__tests__/lessons/enforcement.test.ts`:

```ts
describe('getStudentAttempt answer key', () => {
  it('withholds the correct answers on a failed gate', async () => {
    // assessment.lessonId = 'l1', passingScore 75, attempt score 20
    const attempt = await getStudentAttempt('student1', 'at1')
    expect(attempt!.isGate).toBe(true)
    expect(attempt!.passed).toBe(false)
    // Unlimited retakes plus a visible answer key is pass-by-memorisation.
    expect(attempt!.questions[0].options.every(o => o.isCorrect === null)).toBe(true)
  })

  it('reveals the key on a passed gate', async () => {
    // same, attempt score 90
    const attempt = await getStudentAttempt('student1', 'at1')
    expect(attempt!.passed).toBe(true)
    expect(attempt!.questions[0].options.some(o => o.isCorrect === true)).toBe(true)
  })

  it('reveals the key on a failed subject-level assessment, as today', async () => {
    // assessment.lessonId = null, attempt score 20
    const attempt = await getStudentAttempt('student1', 'at1')
    expect(attempt!.isGate).toBe(false)
    expect(attempt!.questions[0].options.some(o => o.isCorrect === true)).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run lib/__tests__/lessons/enforcement.test.ts`
Expected: FAIL, `isGate` is undefined.

- [ ] **Step 3: Implement the reveal rule**

In `lib/student/queries.ts`, change `AttemptOption.isCorrect` to `boolean | null` with a comment, and add `isGate: boolean` and `passed: boolean` to `StudentAttempt`. Add `lessonId: true` to the nested `assessment` select in `getStudentAttempt`, then before building `questions`:

```ts
  const isGate = attempt.assessment.lessonId != null
  const passingScore = attempt.assessment.passingScore
  const passed =
    attempt.score != null && passingScore != null && attempt.score >= passingScore
  // Hiding the key has to happen here, not in the page: the options are
  // serialised into the payload either way. The student still learns which of
  // their own answers were wrong, from StudentAnswer.isCorrect.
  const revealKey = !isGate || passed
```

and in the `questions` mapping:

```ts
      options: revealKey
        ? q.options
        : q.options.map(o => ({ ...o, isCorrect: null })),
```

Return `isGate` and `passed` in the object.

- [ ] **Step 4: Handle the withheld key in the review UI**

In the attempt page, the option row currently colors by `o.isCorrect`. Make it tolerate null: when `correctOption == null && q.options.some(o => o.isCorrect === null)`, color the chosen option by the answer's own `q.isCorrect` and leave every other option neutral. Replace the "No correct answer configured." fallback with a withheld notice in that case:

```tsx
{q.options.some(o => o.isCorrect === null) && (
  <li className="text-xs text-muted-foreground px-1">
    Correct answers are hidden until you pass. Review the lesson and try again.
  </li>
)}
```

Keep the existing "No correct answer configured." line for the genuine misconfiguration case, which is now `correctOption == null && q.options.every(o => o.isCorrect === false)`.

- [ ] **Step 5: Add the result panel**

Above the per-question breakdown, when `attempt.isGate`:

```tsx
{attempt.isGate && (
  attempt.passed ? (
    <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">
      <p className="text-sm font-semibold text-emerald-800">You passed.</p>
      <p className="text-xs text-emerald-700">The next lesson is now open.</p>
      <Link href={backHref} className="mt-2 inline-block text-xs font-semibold text-emerald-800 underline">
        Back to {attempt.subjectTitle}
      </Link>
    </div>
  ) : (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">
        Not passed yet - you need {attempt.passingScore}%.
      </p>
      <p className="text-xs text-amber-800">
        You can retake this quiz as many times as you need.
      </p>
      <form action={startAttemptAction} className="mt-2">
        <input type="hidden" name="assessmentId" value={attempt.assessmentId} />
        <input type="hidden" name="courseId" value={attempt.courseId} />
        <input type="hidden" name="subjectId" value={attempt.subjectId} />
        <Button type="submit" size="sm">Try again</Button>
      </form>
    </div>
  )
)}
```

`startAttemptAction` is a `useActionState` action, so wrap the retake in the existing client form component pattern used on the assessment launch page rather than calling it bare from a server component.

- [ ] **Step 6: Run the tests, type check and lint**

Run: `pnpm vitest run && ./node_modules/.bin/tsc --noEmit && pnpm lint`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add lib/student/queries.ts "app/(student)/student/courses/[id]/subjects/[sid]/assessments/[aid]/attempt" lib/__tests__/lessons/enforcement.test.ts
git commit -m "feat: add gate result panel and withhold the key on a failed gate"
```

---

### Task 15: End-to-end verification

**Files:** none modified unless a defect is found.

**Interfaces:**
- Consumes: everything.
- Produces: a verified feature.

- [ ] **Step 1: Full check**

Run: `pnpm vitest run && ./node_modules/.bin/tsc --noEmit && pnpm lint`
Expected: all green. Do not proceed on a failure, and do not claim completion without this output.

- [ ] **Step 2: Prove the columns exist against the real database**

Mocked tests cannot catch a missing column, because every test mocks `@/lib/db`. Write a short read-only script **inside the repo root** (a script in `/tmp` cannot resolve the project's node_modules):

```ts
// scripts/check-gating.ts
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const c = await db.course.findFirst({ select: { id: true, sequentialLessons: true } })
const a = await db.assessment.findFirst({ select: { id: true, lessonId: true } })
console.log({ c, a })
await db.$disconnect()
```

Run: `pnpm tsx scripts/check-gating.ts`
Expected: prints without a column error. Delete the script afterwards.

- [ ] **Step 3: Walk the flow in the running app**

Start with `pnpm dev`, then as an admin:

1. Create a quiz on a subject, set "Gates lesson" to Lesson 1, set a passing score of 75, add two multiple-choice questions, publish it.
2. Confirm adding an essay question is refused.
3. Turn on "Sequential lessons" for the course and confirm the affected-student warning appears with a plausible count.

Then as an enrolled student in that course:

4. Lesson 2 shows a lock icon, is greyed, does not expand, and reads "Pass the Lesson 1 quiz to unlock."
5. Open the page source and confirm lesson 2's Drive URLs are **not** in the payload. This is the check that matters most; a greyed row with live links in the HTML would make the feature decorative.
6. Take Lesson 1's quiz and fail it. The result panel offers "Try again" and the correct answers are hidden.
7. Retake and pass. The panel says the next lesson is open, lesson 1 shows a green check, lesson 2 unlocks, and the course progress bar moves.
8. Confirm the subject grade on the course page is unchanged by the quiz, and that it does not appear in the dashboard's recent results.

Then as the subject's teacher:

9. The gate is visible in the assessment list and its edit, publish and delete controls are absent.

- [ ] **Step 4: Fix anything the walkthrough surfaces**

Be picky about the UI here. If the lock icon sits a pixel off the numbered circles it replaces, or the gate row's emphasis reads as an error rather than a call to action, fix it now rather than leaving it.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "test: verify per-lesson assessment gating end to end"
```

---

## Self-Review Notes

Spec coverage checked section by section: data model (Task 1), unlock rule (Task 2), enforcement's five points (Tasks 8, 9, 10), retakes (Task 10), writing the pass (Task 11), best-attempt selection (Task 3), authorization (Task 5), admin surface (Tasks 4, 6, 7), student surface (Task 13), failed-attempt review (Task 14), grade isolation (Task 12), edge cases (covered by the Task 2 unit tests and the Task 15 walkthrough), testing (throughout), migration (Task 1).

Type consistency checked: `GatingLesson`, `GateAssessment`, `computeLockedLessons`, `isLessonSatisfied`, `pickBestAttempt`, `GateContext`, `getPublishBlockers`, `isAdmin`, `getLessonGateState`, `countStudentsAffectedByGating`, `StudentLesson.isLocked` / `.lockedReason` / `.assessment`, `AttemptOption.isCorrect`, `StudentAttempt.isGate` / `.passed` are each defined once and used with the same name and shape everywhere they appear.

One known cross-task dependency to respect: Task 5 changes `authorize`'s return shape in `lib/assessments/actions.ts`, so every action in that file must be updated in the same commit. The type check in Task 5 Step 8 is what catches a miss.
