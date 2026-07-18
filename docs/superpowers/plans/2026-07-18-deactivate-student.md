# Deactivate Student Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin revoke a student's access from the student detail page by flipping `User.isActive`, and make that flag actually enforced everywhere a student can act.

**Architecture:** A new admin server action toggles `User.isActive` for `STUDENT`-role targets only.
A client component in the student detail page's Profile sidebar drives it, with an `AlertDialog` confirmation on deactivation only.
Enforcement rides on queries that already exist: the student layout's user lookup and `createPurchaseAction`'s user lookup each gain one selected column, and a shared `isActiveStudent()` capability covers the remaining student server actions.

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, Prisma 7 with `@prisma/adapter-pg`, Zod 4, Vitest 4, Tailwind 4, shadcn-style UI in `components/ui`.

## Global Constraints

- Package manager is pnpm.
  Never `npm` or `yarn`.
- No schema change and no Prisma migration in this plan.
  `User.isActive` already exists.
- Never use the em dash character.
  Use a plain dash in all copy, code comments and commit messages.
- Do not add a deactivate control to the students list table.
  The detail page is the only entry point.
- Tests live under `lib/__tests__/`, mirroring the path of the code under test.
  Vitest runs in the `node` environment with `globals: true` and the `@` alias pointing at the repo root.
- Run the full suite with `pnpm test --run`.
  A bare `pnpm test` starts watch mode and will hang an agent.
- Commit messages must not add a co-author trailer.

## File Structure

```
lib/auth/capabilities.ts                                  modify  add isActiveStudent()
lib/__tests__/auth/capabilities.test.ts                   modify  add isActiveStudent tests
app/(admin)/admin/students/actions.ts                     create  toggleStudentActiveAction
lib/__tests__/students/toggle-active.test.ts              create  action authorization + flip tests
app/(admin)/admin/students/deactivate-student-button.tsx  create  client component + confirm dialog
app/(admin)/admin/students/[id]/page.tsx                  modify  render button in Profile sidebar
app/(student)/layout.tsx                                  modify  select isActive, redirect when false
app/(student)/student/courses/[id]/subjects/[sid]/actions.ts              modify  guard both actions
app/(student)/student/courses/[id]/subjects/[sid]/assessments/actions.ts  modify  guard both actions
lib/purchases/actions.ts                                  modify  guard via existing user lookup
app/(auth)/login/actions.ts                               modify  correct inactive-account message
```

`toggleStudentActiveAction` gets its own file rather than joining `app/(admin)/admin/users/actions.ts`.
The two actions permit different target roles and need different self-targeting rules, and merging them would create one function whose permission logic branches on its own input.

---

### Task 1: `isActiveStudent` capability

**Files:**
- Modify: `lib/auth/capabilities.ts`
- Test: `lib/__tests__/auth/capabilities.test.ts:1-9` (extend the existing `vi.mock` block) and append a new `describe`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `isActiveStudent(session: SessionLike | null): Promise<boolean>` exported from `@/lib/auth/capabilities`.
  `SessionLike` is the existing local type `{ userId: string; role: UserRole }`.
  Returns `false` for a null session, for a user row that does not exist, and for `isActive === false`.
  Tasks 4 and 5 call it.

Note on shape: the spec described a throwing `assertActiveStudent`.
This returns a boolean instead, because every consumer is a server action returning `{ error: string | null }`, and a throw there escapes to the error boundary as a generic crash page rather than a readable message.
This mirrors the `canManageSubject` boolean already in this file.

- [ ] **Step 1: Write the failing test**

Extend the existing `vi.mock('@/lib/db', ...)` block at the top of `lib/__tests__/auth/capabilities.test.ts` to add a `user` model, so it reads:

```ts
vi.mock('@/lib/db', () => ({
  db: {
    subjectTeacher: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))
```

Update the import line to pull in the new function:

```ts
import { canManageSubject, isActiveStudent } from '@/lib/auth/capabilities'
```

Append this `describe` block to the end of the file:

```ts
describe('isActiveStudent', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns false for no session without a DB lookup', async () => {
    expect(await isActiveStudent(null)).toBe(false)
    expect(db.user.findUnique).not.toHaveBeenCalled()
  })

  it('returns true for an active student', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ isActive: true } as never)
    expect(await isActiveStudent({ userId: 's1', role: 'STUDENT' })).toBe(true)
    expect(db.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' } }),
    )
  })

  it('returns false for a deactivated student', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ isActive: false } as never)
    expect(await isActiveStudent({ userId: 's1', role: 'STUDENT' })).toBe(false)
  })

  it('returns false when the user row is gone', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null)
    expect(await isActiveStudent({ userId: 'ghost', role: 'STUDENT' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run lib/__tests__/auth/capabilities.test.ts`
Expected: FAIL. The import of `isActiveStudent` resolves to `undefined`, producing "isActiveStudent is not a function".

- [ ] **Step 3: Write minimal implementation**

Append to `lib/auth/capabilities.ts`:

```ts
// Is this session a student who is still allowed in?
// Deactivation flips User.isActive, but sessions are stateless 7-day JWTs, so
// every student entry point has to re-check the flag rather than trust the token.
export async function isActiveStudent(session: SessionLike | null): Promise<boolean> {
  if (!session) return false

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { isActive: true },
  })

  return user?.isActive === true
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run lib/__tests__/auth/capabilities.test.ts`
Expected: PASS, 9 tests (5 pre-existing `canManageSubject`, 4 new).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/capabilities.ts lib/__tests__/auth/capabilities.test.ts
git commit -m "feat: add isActiveStudent capability check"
```

---

### Task 2: `toggleStudentActiveAction`

**Files:**
- Create: `app/(admin)/admin/students/actions.ts`
- Test: `lib/__tests__/students/toggle-active.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `toggleStudentActiveAction(_prev: ActionState, formData: FormData): Promise<ActionState>` exported from `@/app/(admin)/admin/students/actions`, where `ActionState` is `{ error: string | null }`.
  Reads a `userId` string field from the form data.
  Task 3 binds it with `useActionState`.

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/students/toggle-active.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { toggleStudentActiveAction } from '@/app/(admin)/admin/students/actions'

function form(userId: string): FormData {
  const fd = new FormData()
  fd.set('userId', userId)
  return fd
}

const initial = { error: null }

describe('toggleStudentActiveAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects an unauthenticated caller', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const result = await toggleStudentActiveAction(initial, form('s1'))
    expect(result.error).toBe('Unauthorized')
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it('rejects a TEACHER caller', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 't1', role: 'TEACHER' })
    const result = await toggleStudentActiveAction(initial, form('s1'))
    expect(result.error).toBe('Forbidden')
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it('rejects a STUDENT caller', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 's9', role: 'STUDENT' })
    const result = await toggleStudentActiveAction(initial, form('s1'))
    expect(result.error).toBe('Forbidden')
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it('rejects a missing userId', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' })
    const result = await toggleStudentActiveAction(initial, new FormData())
    expect(result.error).toBe('Invalid student ID.')
  })

  it('returns not found for an unknown id', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' })
    vi.mocked(db.user.findUnique).mockResolvedValue(null)
    const result = await toggleStudentActiveAction(initial, form('ghost'))
    expect(result.error).toBe('Student not found.')
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it('refuses to touch a non-student target', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' })
    vi.mocked(db.user.findUnique).mockResolvedValue({
      isActive: true,
      role: 'ADMIN',
    } as never)
    const result = await toggleStudentActiveAction(initial, form('a2'))
    expect(result.error).toBe('Forbidden.')
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it('deactivates an active student', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' })
    vi.mocked(db.user.findUnique).mockResolvedValue({
      isActive: true,
      role: 'STUDENT',
    } as never)
    const result = await toggleStudentActiveAction(initial, form('s1'))
    expect(result.error).toBeNull()
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { isActive: false },
    })
  })

  it('reactivates a deactivated student', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'SUPER_ADMIN' })
    vi.mocked(db.user.findUnique).mockResolvedValue({
      isActive: false,
      role: 'STUDENT',
    } as never)
    const result = await toggleStudentActiveAction(initial, form('s1'))
    expect(result.error).toBeNull()
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { isActive: true },
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run lib/__tests__/students/toggle-active.test.ts`
Expected: FAIL. The module `@/app/(admin)/admin/students/actions` does not exist yet, so the suite fails to collect.

- [ ] **Step 3: Write minimal implementation**

Create `app/(admin)/admin/students/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

type ActionState = { error: string | null }

// Deactivating a student revokes access without destroying their enrollments,
// grades, payments or certificates. It is reversible from the same button.
//
// This action only ever touches STUDENT rows. Admins and teachers are handled
// by toggleUserActiveAction in app/(admin)/admin/users/actions.ts, which in turn
// refuses student targets, so neither action reaches the other's population.
export async function toggleStudentActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  const userId = formData.get('userId')
  if (typeof userId !== 'string' || !userId) return { error: 'Invalid student ID.' }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { isActive: true, role: true },
  })
  if (!target) return { error: 'Student not found.' }

  // No self-deactivation guard is needed: an admin is never a STUDENT, so this
  // check already makes self-targeting impossible.
  if (target.role !== 'STUDENT') return { error: 'Forbidden.' }

  try {
    await db.user.update({
      where: { id: userId },
      data: { isActive: !target.isActive },
    })
  } catch (err) {
    console.error('[toggleStudentActive]', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/students')
  revalidatePath('/admin/students/' + userId)
  return { error: null }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run lib/__tests__/students/toggle-active.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/admin/students/actions.ts" lib/__tests__/students/toggle-active.test.ts
git commit -m "feat: add toggleStudentActiveAction for admin student deactivation"
```

---

### Task 3: Deactivate button and detail page wiring

**Files:**
- Create: `app/(admin)/admin/students/deactivate-student-button.tsx`
- Modify: `app/(admin)/admin/students/[id]/page.tsx` (the Status `<div>` in the Profile sidebar, and the import block at the top)

**Interfaces:**
- Consumes: `toggleStudentActiveAction` from Task 2.
- Produces: `DeactivateStudentButton` component taking `{ studentId: string; isActive: boolean; studentName: string }`.
  No later task consumes it.

This task has no unit test.
The repo tests logic under `lib/__tests__/` and has no component test precedent, and the logic under this component is already covered by Task 2.
Step 4 is a manual browser check instead.

- [ ] **Step 1: Write the component**

Create `app/(admin)/admin/students/deactivate-student-button.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { toggleStudentActiveAction } from './actions'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

type Props = {
  studentId: string
  isActive: boolean
  studentName: string
}

export function DeactivateStudentButton({ studentId, isActive, studentName }: Props) {
  const [state, formAction, isPending] = useActionState(toggleStudentActiveAction, {
    error: null,
  })

  // Reactivation is harmless and skips the dialog. Deactivation cuts off access,
  // so it gets one deliberate confirmation step.
  if (!isActive) {
    return (
      <form action={formAction}>
        <input type="hidden" name="userId" value={studentId} />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={isPending}
          aria-label={`Reactivate ${studentName}`}
          className="w-full"
        >
          {isPending ? 'Reactivating...' : 'Reactivate'}
        </Button>
        {state.error && <p className="text-xs text-destructive mt-1">{state.error}</p>}
      </form>
    )
  }

  const formId = `deactivate-student-${studentId}`

  return (
    <>
      <form action={formAction} id={formId}>
        <input type="hidden" name="userId" value={studentId} />
      </form>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            aria-label={`Deactivate ${studentName}`}
            className="text-destructive hover:text-destructive w-full"
          >
            {isPending ? 'Deactivating...' : 'Deactivate'}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {studentName}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will be signed out and will not be able to log in, submit assessments, or
              make purchases. Their enrollments, grades, payments and certificates are kept,
              and you can reactivate them at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" form={formId}>
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {state.error && <p className="text-xs text-destructive mt-1">{state.error}</p>}
    </>
  )
}
```

The `form={formId}` attribute is load-bearing and must not be simplified away.
`AlertDialogContent` wraps itself in `AlertDialogPortal`, so the dialog renders into `document.body`, outside the `<form>` element.
A plain `type="submit"` button there belongs to no form and would silently do nothing when clicked.
The HTML `form` attribute associates the button with a form anywhere in the document, which is why the form is rendered as an empty sibling holding only the hidden input.

The trigger is `type="button"` so opening the dialog never submits.

- [ ] **Step 2: Wire it into the detail page**

In `app/(admin)/admin/students/[id]/page.tsx`, add the import below the existing `PageHeader` import:

```tsx
import { DeactivateStudentButton } from '../deactivate-student-button'
```

Then replace the Status block in the Profile sidebar.
Find this existing markup:

```tsx
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
```

Replace it with:

```tsx
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="mt-0.5 space-y-2">
                <span className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                  student.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-zinc-100 text-zinc-600',
                )}>
                  {student.isActive ? 'Active' : 'Inactive'}
                </span>
                <DeactivateStudentButton
                  studentId={student.id}
                  isActive={student.isActive}
                  studentName={`${student.firstName} ${student.lastName}`}
                />
              </dd>
            </div>
```

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors.

If `tsc` reports that `student.id` does not exist, check `StudentDetail` in `lib/students/queries.ts` - it declares `id: string`, so this should resolve.

- [ ] **Step 4: Verify in the browser**

Run `pnpm dev`, log in as an admin, and open `/admin/students`.
Click into any student.

Confirm all of the following:
- The Profile sidebar shows the Status badge with a `Deactivate` button directly beneath it.
- Clicking `Deactivate` opens a confirmation dialog naming that student.
- `Cancel` closes the dialog and changes nothing.
- Confirming flips the badge to `Inactive` and the button to `Reactivate` without a full page reload.
- `Reactivate` flips it straight back with no dialog.
- The button spans the sidebar width and does not overflow or crowd the `Member since` row below it.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/admin/students/deactivate-student-button.tsx" "app/(admin)/admin/students/[id]/page.tsx"
git commit -m "feat: add student deactivate control to admin detail page"
```

---

### Task 4: Enforce `isActive` in the student layout

**Files:**
- Modify: `app/(student)/layout.tsx`

**Interfaces:**
- Consumes: nothing.
  This uses the layout's own existing query, not `isActiveStudent`, because that query already runs here and adding a column to it costs nothing while a second call would add a round trip.
- Produces: nothing consumed by later tasks.

Enforcement lives here rather than in `proxy.ts` because the proxy runs on the Edge runtime, while `lib/db.ts` uses `PrismaClient` with `@prisma/adapter-pg`, declared in `serverExternalPackages` and unable to run there.

- [ ] **Step 1: Add the check**

In `app/(student)/layout.tsx`, replace the user lookup and the lines around it.
Find:

```tsx
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { firstName: true },
  })
```

Replace with:

```tsx
  // isActive is re-checked on every student page load: sessions are stateless
  // 7-day JWTs, so an admin deactivating a student mid-session would otherwise
  // not take effect until the token expired.
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { firstName: true, isActive: true },
  })
  if (!user?.isActive) redirect('/login')
```

`redirect` is already imported at the top of this file.

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.
The `user?.firstName ?? ''` further down still typechecks, since the redirect above does not narrow `user` for TypeScript.

- [ ] **Step 3: Verify the cutoff in the browser**

This is the behavior the whole feature rests on, so exercise it end to end rather than trusting the code.

1. In one browser, log in as a student and land on `/student/dashboard`.
2. In a second browser or a private window, log in as an admin and deactivate that same student.
3. Back in the student's browser, click any nav link.

Expected: the student is redirected to `/login`, not shown the page.
Then reactivate the student and confirm they can log in again.

- [ ] **Step 4: Commit**

```bash
git add "app/(student)/layout.tsx"
git commit -m "feat: block deactivated students at the student layout"
```

---

### Task 5: Guard student server actions and fix the login message

**Files:**
- Modify: `app/(student)/student/courses/[id]/subjects/[sid]/actions.ts` (both exported actions)
- Modify: `app/(student)/student/courses/[id]/subjects/[sid]/assessments/actions.ts` (both exported actions)
- Modify: `lib/purchases/actions.ts` (`createPurchaseAction`)
- Modify: `app/(auth)/login/actions.ts`

**Interfaces:**
- Consumes: `isActiveStudent` from Task 1.
- Produces: nothing consumed by later tasks.

Layouts do not re-run for server actions, so Task 4 alone leaves a deactivated student with a stale open tab able to submit work.

- [ ] **Step 1: Guard the lesson actions**

In `app/(student)/student/courses/[id]/subjects/[sid]/actions.ts`, add to the imports:

```ts
import { isActiveStudent } from '@/lib/auth/capabilities'
```

In **both** `markLessonDoneAction` and `unmarkLessonDoneAction`, find this line:

```ts
  if (!session) return { error: 'Unauthorized' }
```

and add the guard directly beneath it:

```ts
  if (!(await isActiveStudent(session))) return { error: 'Your account is inactive.' }
```

- [ ] **Step 2: Guard the assessment actions**

In `app/(student)/student/courses/[id]/subjects/[sid]/assessments/actions.ts`, add to the imports:

```ts
import { isActiveStudent } from '@/lib/auth/capabilities'
```

In **both** `startAttemptAction` and `submitAttemptAction`, find:

```ts
  if (!session) return { error: 'Unauthorized' }
```

and add beneath it:

```ts
  if (!(await isActiveStudent(session))) return { error: 'Your account is inactive.' }
```

- [ ] **Step 3: Guard purchases with no extra query**

`createPurchaseAction` in `lib/purchases/actions.ts` already loads the user row, so extend that select rather than calling `isActiveStudent`.

Find:

```ts
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { email: true, firstName: true, studentType: true },
  })
  if (!user) return { error: 'Account not found.' }
```

Replace with:

```ts
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { email: true, firstName: true, studentType: true, isActive: true },
  })
  if (!user) return { error: 'Account not found.' }
  if (!user.isActive) return { error: 'Your account is inactive.' }
```

- [ ] **Step 4: Fix the login error message**

`isActive` does double duty as "email verified" and "admin enabled," and the login gate cannot tell the two apart, so the message has to be true for both.
Today it sends a deliberately deactivated student hunting for a verification email that will never arrive.

In `app/(auth)/login/actions.ts`, find:

```ts
  if (!user.isActive) {
    return { error: 'Account not verified. Check your email for a verification link.' }
  }
```

Replace with:

```ts
  if (!user.isActive) {
    return {
      error:
        "This account isn't active. If you just registered, check your email for a verification link; otherwise contact your administrator.",
    }
  }
```

- [ ] **Step 5: Run the full suite, typecheck and lint**

Run: `pnpm test --run && pnpm exec tsc --noEmit && pnpm lint`
Expected: all tests pass, no type errors, no lint errors.

- [ ] **Step 6: Verify the action guard in the browser**

The layout redirect in Task 4 masks this path on navigation, so reach it the way a real stale tab would.

1. As a student, open a subject page with an incomplete lesson and leave the tab open.
2. In another window, deactivate that student as an admin.
3. Without reloading, click the mark-lesson-done button in the student's open tab.

Expected: the inline error reads "Your account is inactive." and the lesson is not marked.
The page must show that message rather than a crashed error boundary.

Then reactivate the student and confirm the same button works again.

- [ ] **Step 7: Commit**

```bash
git add "app/(student)/student/courses/[id]/subjects/[sid]/actions.ts" "app/(student)/student/courses/[id]/subjects/[sid]/assessments/actions.ts" lib/purchases/actions.ts "app/(auth)/login/actions.ts"
git commit -m "feat: reject deactivated students in student server actions"
```

---

## Done Criteria

- An admin can deactivate and reactivate a student from `/admin/students/[id]`, with a confirmation on deactivation only.
- The action refuses non-admin callers and refuses any target that is not a `STUDENT`.
- A deactivated student is redirected to `/login` on their next student page load, and cannot mark lessons, start or submit attempts, or create purchases.
- A deactivated student attempting to log in sees a message that is accurate whether they were never verified or were deactivated by an admin.
- No student row, enrollment, grade, payment or certificate is deleted at any point.
- `pnpm test --run`, `pnpm exec tsc --noEmit` and `pnpm lint` all pass.
