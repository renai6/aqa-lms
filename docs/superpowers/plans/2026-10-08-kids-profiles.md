# Kids Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a parent add kid profiles to their student account, switch the student portal to a kid, and enroll and study as that kid, with rosters, grades, certificates and emails all handled correctly.

**Architecture:** A kid is a real `STUDENT` user with no email or password and a `guardianId` pointing at the parent.
`getSession()` resolves an `active_profile` cookie to the kid after verifying ownership in the database, so every existing student page works for the kid unchanged; a new `getAccountSession()` returns the logged-in account for account-level actions.
Contact details and notification addresses for kids resolve to the guardian through one helper module.

**Tech Stack:** Next.js App Router (server components and server actions), Prisma 7 on Postgres (Supabase), zod, vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-08-kids-profiles-design.md`

## Global Constraints

- Package manager is pnpm. Never npm or yarn.
- Match the quote and semicolon style of the file being edited (`lib/students/*`, `lib/auth/*`, `app/(admin)/admin/students/*`, `components/student/*` use single quotes and no semicolons; `lib/payments/*`, `lib/purchases/queries.ts`, `app/(student)/student/checkout/*` use double quotes and semicolons). Never run `prettier --write` on an existing file.
- Never use the em dash character in code, copy, or comments. Use a plain hyphen.
- Do not run `pnpm prisma format` (it rewrites unrelated models).
- The database is the shared production Supabase instance. Migrations are applied by the user from their own terminal. Never write test data to it without asking the user first.
- Commit messages must not include a Co-Authored-By line or any agent attribution.
- Kid gender is required (gender-restricted subjects fail closed for a null gender).
- Cookie name is exactly `active_profile`; options `httpOnly`, `sameSite: 'lax'`, `secure` in production, `path: '/'`, `maxAge: 60 * 60 * 24 * 7`.
- Baseline before starting: `./node_modules/.bin/tsc --noEmit` is clean, `pnpm lint` reports 6 warnings and 0 errors.

## Review Focus

1. A parent removes a kid, or an admin deactivates a kid, while that kid is the active profile in another tab: the next request must silently fall back to the parent, never error and never show the kid's data. Pinned in Task 3 (inactive or missing kid falls back) and Task 5 (remove).
2. A shared computer: parent A was viewing their kid, signs out, and parent B logs in: B must start as themselves, not with A's cookie resolving to nothing or something stale. Pinned in Task 3 (`createSession` and `clearSession` delete the cookie).
3. A forged `active_profile` cookie with another family's kid id: must resolve to the logged-in account. Pinned in Task 3 and in Task 5 (`switchProfileAction` refuses).
4. A kid's name containing HTML (`<b>Ana</b>`) in a notification email sent to the parent: must be escaped. Pinned in Task 1.
5. A kid enrolled in a course with a gender-restricted subject: must see the subject matching their gender, which requires gender to be mandatory on every kid form. Pinned in Task 4 (`parseDependentForm` rejects a missing gender).

---

### Task 1: Contact helpers and kid line in emails

Pure helpers, no schema change yet, so this lands green on its own.

**Files:**
- Create: `lib/students/contact.ts`
- Create: `lib/__tests__/students/contact.test.ts`
- Modify: `lib/email/template.ts` (add `learnerLine`)
- Modify: `lib/purchases/email.ts`, `lib/payments/email.ts` (accept `learnerFirstName`)
- Create: `lib/__tests__/email/learner-line.test.ts`

**Interfaces:**
- Produces:
  - `GUARDIAN_CONTACT_SELECT` (Prisma select for a guardian: `firstName`, `lastName`, `email`, `contactNumber`)
  - `contactOf(user: { email: string | null; contactNumber?: string | null; guardian?: GuardianContact | null }): Contact` where `Contact = { email: string; contactNumber: string | null; parentName: string | null }`
  - `NOTIFY_SELECT` (Prisma select: `firstName`, `email`, `guardian: { firstName, email }`)
  - `notificationTarget(user): NotificationTarget | null` where `NotificationTarget = { to: string; firstName: string; learnerFirstName: string | null }`
  - `learnerLine(learnerFirstName: string | null | undefined): string` in `lib/email/template.ts`
  - Every one of the six send functions accepts an optional `learnerFirstName?: string | null`.

- [ ] **Step 1: Write the failing contact test**

`lib/__tests__/students/contact.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { contactOf, notificationTarget } from '@/lib/students/contact'

const parent = { firstName: 'Raffi', lastName: 'Muloc', email: 'raffi@example.com', contactNumber: '09171234567' }

describe('contactOf', () => {
  it('returns the student own details when there is no guardian', () => {
    expect(contactOf({ email: 's@example.com', contactNumber: '0918', guardian: null })).toEqual({
      email: 's@example.com',
      contactNumber: '0918',
      parentName: null,
    })
  })

  it('returns the guardian details and name for a kid', () => {
    expect(contactOf({ email: null, contactNumber: null, guardian: parent })).toEqual({
      email: 'raffi@example.com',
      contactNumber: '09171234567',
      parentName: 'Raffi Muloc',
    })
  })

  it('treats a missing guardian field like no guardian', () => {
    expect(contactOf({ email: 's@example.com' })).toEqual({
      email: 's@example.com',
      contactNumber: null,
      parentName: null,
    })
  })
})

describe('notificationTarget', () => {
  it('addresses a student with an email directly', () => {
    expect(notificationTarget({ firstName: 'Sam', email: 's@example.com', guardian: null })).toEqual({
      to: 's@example.com',
      firstName: 'Sam',
      learnerFirstName: null,
    })
  })

  it('addresses a kid through the guardian and names the kid', () => {
    expect(
      notificationTarget({ firstName: 'Ana', email: null, guardian: { firstName: 'Raffi', email: 'raffi@example.com' } }),
    ).toEqual({ to: 'raffi@example.com', firstName: 'Raffi', learnerFirstName: 'Ana' })
  })

  it('returns null when nobody has an address', () => {
    expect(notificationTarget({ firstName: 'Ana', email: null, guardian: null })).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run lib/__tests__/students/contact.test.ts`
Expected: FAIL, cannot resolve `@/lib/students/contact`.

- [ ] **Step 3: Implement `lib/students/contact.ts`**

```ts
// A kid profile has no email or phone of its own: the parent who manages it is
// the contact. Every admin, teacher and email surface resolves a student's
// contact details through here, so that rule lives in one place.

type GuardianContact = {
  firstName: string
  lastName: string
  email: string | null
  contactNumber: string | null
}

export const GUARDIAN_CONTACT_SELECT = {
  select: { firstName: true, lastName: true, email: true, contactNumber: true },
} as const

export type Contact = {
  email: string
  contactNumber: string | null
  // Set only for a kid: the parent whose email and phone are shown instead.
  parentName: string | null
}

export function contactOf(user: {
  email: string | null
  contactNumber?: string | null
  guardian?: GuardianContact | null
}): Contact {
  const g = user.guardian
  if (!g) {
    return { email: user.email ?? '', contactNumber: user.contactNumber ?? null, parentName: null }
  }
  return { email: g.email ?? '', contactNumber: g.contactNumber, parentName: `${g.firstName} ${g.lastName}` }
}

export const NOTIFY_SELECT = {
  firstName: true,
  email: true,
  guardian: { select: { firstName: true, email: true } },
} as const

export type NotificationTarget = {
  to: string
  firstName: string
  // Set when the email is about a kid, so the parent knows which child it concerns.
  learnerFirstName: string | null
}

export function notificationTarget(user: {
  firstName: string
  email: string | null
  guardian?: { firstName: string; email: string | null } | null
}): NotificationTarget | null {
  if (user.email) return { to: user.email, firstName: user.firstName, learnerFirstName: null }
  if (user.guardian?.email) {
    return { to: user.guardian.email, firstName: user.guardian.firstName, learnerFirstName: user.firstName }
  }
  return null
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm vitest run lib/__tests__/students/contact.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the failing email test**

`lib/__tests__/email/learner-line.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const sent = vi.hoisted(() => [] as { html: string }[])

vi.mock('@/lib/email/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email/client')>()),
  sendEmail: vi.fn(async (params: { html: string }) => {
    sent.push(params)
  }),
}))

import { sendPurchaseApprovalEmail } from '@/lib/purchases/email'
import { sendPaymentRejectionEmail } from '@/lib/payments/email'

beforeEach(() => {
  sent.length = 0
  process.env.APP_URL = 'http://localhost:3000'
})

describe('kid line in transactional email', () => {
  it('names the kid when the email is about a kid', async () => {
    await sendPurchaseApprovalEmail({ to: 'p@example.com', firstName: 'Raffi', courseNames: ['Kids 1'], learnerFirstName: 'Ana' })
    expect(sent[0].html).toContain('This update is about <strong>Ana</strong>')
  })

  it('omits the line for a student acting for themselves', async () => {
    await sendPurchaseApprovalEmail({ to: 's@example.com', firstName: 'Sam', courseNames: ['Course'] })
    expect(sent[0].html).not.toContain('This update is about')
  })

  it('escapes the kid name', async () => {
    await sendPaymentRejectionEmail({
      to: 'p@example.com',
      firstName: 'Raffi',
      courseTitle: 'Kids 1',
      reason: 'Blurry proof',
      learnerFirstName: '<b>Ana</b>',
    })
    expect(sent[0].html).toContain('&lt;b&gt;Ana&lt;/b&gt;')
    expect(sent[0].html).not.toContain('<b>Ana</b>')
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm vitest run lib/__tests__/email/learner-line.test.ts`
Expected: FAIL on the first and third tests (no kid line rendered).

- [ ] **Step 7: Add `learnerLine` to `lib/email/template.ts`**

Add at the top of the file, after the doc comment:

```ts
import { escapeHtml } from '@/lib/email/client'
```

Add after the `p` function:

```ts
/**
 * Emails about a kid's enrollment go to the parent. This names the kid, so a
 * parent of several children knows which one the email is about. Empty when
 * the student is acting for themselves.
 */
export function learnerLine(learnerFirstName: string | null | undefined): string {
  if (!learnerFirstName) return ''
  return p(`This update is about <strong>${escapeHtml(learnerFirstName)}</strong>'s enrollment.`)
}
```

- [ ] **Step 8: Thread `learnerFirstName` through all six send functions**

In `lib/purchases/email.ts`, change the import to:

```ts
import { button, learnerLine, note, p, renderEmail, ul } from "@/lib/email/template";
```

In each of `sendPurchaseConfirmationEmail`, `sendPurchaseApprovalEmail`, `sendPurchaseRejectionEmail`, add to the `params` type:

```ts
  learnerFirstName?: string | null;
```

and insert `learnerLine(params.learnerFirstName) +` directly after the greeting line, for example in the approval email:

```ts
      body:
        p(`Assalamualaykum ${escapeHtml(params.firstName)},`) +
        learnerLine(params.learnerFirstName) +
        p("Your purchase has been approved. You now have access to:") +
```

Do the same in `lib/payments/email.ts` for `sendPaymentConfirmationEmail`, `sendPaymentApprovalEmail`, `sendPaymentRejectionEmail`, changing its import to:

```ts
import { button, learnerLine, note, p, renderEmail } from "@/lib/email/template";
```

- [ ] **Step 9: Run the tests and typecheck**

Run: `pnpm vitest run lib/__tests__/email lib/__tests__/students && ./node_modules/.bin/tsc --noEmit`
Expected: all PASS, tsc prints nothing.

- [ ] **Step 10: Commit**

```bash
git add lib/students/contact.ts lib/__tests__/students/contact.test.ts lib/email/template.ts lib/purchases/email.ts lib/payments/email.ts lib/__tests__/email/learner-line.test.ts
git commit -m "feat(students): resolve kid contact details and name the kid in emails"
```

---

### Task 2: Schema, migration, and every place that assumed a student has an email

**Files:**
- Modify: `prisma/schema.prisma` (model `User`)
- Create (generated by the user's `migrate dev`): `prisma/migrations/<timestamp>_kids_profiles/migration.sql`
- Modify: `app/(auth)/login/actions.ts`, `app/change-password/actions.ts`
- Modify: `lib/users/queries.ts`, `lib/courses/queries.ts` (type widening only)
- Modify: `lib/students/queries.ts`, `lib/teacher/queries.ts`, `lib/purchases/queries.ts`, `lib/payments/queries.ts`, `lib/payments/monthly-queries.ts`, `lib/payments/monthly.ts`
- Modify: `lib/purchases/actions.ts`, `lib/payments/actions.ts`, `app/(admin)/admin/purchases/[id]/actions.ts`, `app/(admin)/admin/payments/[id]/actions.ts`
- Create: `components/students/kid-note.tsx`
- Modify (display): `app/(admin)/admin/students/student-table.tsx`, `app/(admin)/admin/students/[id]/page.tsx`, `app/(admin)/admin/courses/[id]/course-roster.tsx`, `app/(teacher)/teacher/subjects/[sid]/students/page.tsx`, `app/(admin)/admin/purchases/page.tsx`, `app/(admin)/admin/purchases/[id]/page.tsx`, `app/(admin)/admin/payments/page.tsx`, `app/(admin)/admin/payments/[id]/page.tsx`, `app/(admin)/admin/payments/monthly/monthly-matrix.tsx`, `app/api/admin/students/export/route.ts`
- Test: `lib/__tests__/purchases/create-pay-later.test.ts` (add one case)

**Interfaces:**
- Consumes: `contactOf`, `GUARDIAN_CONTACT_SELECT`, `notificationTarget`, `NOTIFY_SELECT` from Task 1.
- Produces:
  - Prisma `User.guardianId`, `User.guardian`, `User.dependents`; `User.email` and `User.passwordHash` nullable.
  - `parentName: string | null` on `StudentRow`, `StudentExportRow`, `StudentDetail`, `RosterRow`, `SubjectStudentRow`, `AdminPurchaseRow`, `AdminPurchaseDetail['student']`, `AdminPaymentRow`, `AdminPaymentDetail['student']`, `MatrixRow`.
  - `KidNote({ parentName }: { parentName: string | null })` component.

- [ ] **Step 1: Edit the `User` model**

In `prisma/schema.prisma`, model `User`, replace:

```prisma
  email        String @unique
  passwordHash String
```

with (hand-aligned, do not run `prisma format`):

```prisma
  // Null for a kid profile, which never logs in. Postgres allows many nulls
  // under the unique index.
  email        String? @unique
  passwordHash String?
```

and add after `studentType        StudentType?`:

```prisma
  // Set on a kid profile: the parent account that manages it. A kid is a
  // regular STUDENT the parent studies as from their own login.
  guardianId         String?
  guardian           User?        @relation("Guardianship", fields: [guardianId], references: [id])
  dependents         User[]       @relation("Guardianship")
```

and add before the closing brace of the model:

```prisma

  @@index([guardianId])
```

- [ ] **Step 2: Ask the user to create and apply the migration**

Stop and ask the user to run in their own terminal:

```bash
pnpm prisma migrate dev --name kids_profiles
```

Then verify the new folder exists and contains exactly these statements (column order may differ):

```bash
cat prisma/migrations/*_kids_profiles/migration.sql
```

Expected content:

```sql
ALTER TABLE "User" ADD COLUMN     "guardianId" TEXT,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "passwordHash" DROP NOT NULL;
CREATE INDEX "User_guardianId_idx" ON "User"("guardianId");
ALTER TABLE "User" ADD CONSTRAINT "User_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

If `migrate dev` proposes a reset, stop: per project memory this means the branch is behind `origin/main`; never accept a reset.

Then run: `pnpm prisma generate`

- [ ] **Step 3: List the type errors the schema change exposes**

Run: `./node_modules/.bin/tsc --noEmit 2>&1 | grep -o '^[^(]*' | sort -u`
Expected: errors in the files listed for this task. Fix them with Steps 4 to 9.

- [ ] **Step 4: Auth guards**

`app/(auth)/login/actions.ts`, replace:

```ts
  if (!user || !(await comparePassword(password, user.passwordHash))) {
```

with:

```ts
  // A kid profile has neither an email nor a password, so it can never match.
  if (!user?.email || !user.passwordHash || !(await comparePassword(password, user.passwordHash))) {
```

and change the `createSession` call's `email: user.email` (now narrowed to `string` by the guard; no change needed if tsc is satisfied).

`app/change-password/actions.ts`, replace:

```ts
  if (!user) return { error: 'User not found.' }
```

with:

```ts
  if (!user?.email) return { error: 'User not found.' }
```

`lib/users/queries.ts`: change the row type's `email: string` to `email: string | null`.
`lib/courses/queries.ts`: change `TeacherRow`'s `user: { id: string; firstName: string; lastName: string; email: string }` to `email: string | null`, and `TeacherOption`'s `email: string;` to `email: string | null;`.
These are staff rows, which always have an email; the widening only satisfies the type.

- [ ] **Step 5: Student queries carry the parent**

`lib/students/queries.ts`:

Add the import:

```ts
import { contactOf, GUARDIAN_CONTACT_SELECT } from '@/lib/students/contact'
```

Add `parentName: string | null` after `email: string` in `StudentRow`, `StudentDetail` and `RosterRow`.

In `findStudents` and `getAllStudents`, add to the `select`:

```ts
      guardian: GUARDIAN_CONTACT_SELECT,
```

and replace the leading `...u,` in each `users.map((u) => ({ ...u, enrollments: ... }))` with explicit fields, so `guardian` is not leaked into the row:

```ts
  return users.map(({ guardian, ...u }) => {
    const contact = contactOf({ ...u, guardian })
    return {
      ...u,
      email: contact.email,
      contactNumber: contact.contactNumber,
      parentName: contact.parentName,
      enrollments: /* the existing enrollments mapping, unchanged */,
    }
  })
```

(Keep each function's existing `enrollments` mapping body exactly as it is.)

In `getStudentById`, add `guardian: GUARDIAN_CONTACT_SELECT,` to the `select`, compute `const contact = contactOf(user)` after the role check, and set `email: contact.email`, `contactNumber: contact.contactNumber`, `parentName: contact.parentName` in the returned object.

In `getCourseRoster`, add `guardian: GUARDIAN_CONTACT_SELECT,` to `user.select`, and in the mapping replace `email: e.user.email,` with:

```ts
    ...(({ email, parentName }) => ({ email, parentName }))(contactOf(e.user)),
```

- [ ] **Step 6: Teacher, purchase and payment queries carry the parent**

`lib/teacher/queries.ts`, `getSubjectStudents`: add `parentName: string | null` to `SubjectStudentRow`, add `guardian: GUARDIAN_CONTACT_SELECT` to the user select (import from `@/lib/students/contact`), and map:

```ts
  return enrollments.map((e) => {
    const contact = contactOf(e.user)
    return {
      id: e.user.id,
      firstName: e.user.firstName,
      lastName: e.user.lastName,
      email: contact.email,
      parentName: contact.parentName,
      enrolledAt: e.enrolledAt,
    }
  })
```

`lib/purchases/queries.ts` (double quotes, semicolons):
- Import `import { contactOf, GUARDIAN_CONTACT_SELECT } from "@/lib/students/contact";`
- `AdminPurchaseRow`: add `parentName: string | null;` after `studentEmail`.
- `getAdminPurchasesByStatus`: user select becomes `{ firstName: true, lastName: true, email: true, guardian: GUARDIAN_CONTACT_SELECT }`; in the mapping replace `studentEmail: r.user.email,` with `studentEmail: contactOf(r.user).email,` and add `parentName: contactOf(r.user).parentName,`.
- `AdminPurchaseDetail.student`: add `parentName: string | null;`.
- `getAdminPurchaseById`: add `guardian: GUARDIAN_CONTACT_SELECT,` to the user select, and replace `student: r.user,` with:

```ts
    student: (() => {
      const contact = contactOf(r.user);
      return {
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        email: contact.email,
        contactNumber: contact.contactNumber,
        parentName: contact.parentName,
      };
    })(),
```

`lib/payments/queries.ts`: the same pattern.
- `AdminPaymentRow`: add `parentName: string | null;`; add `guardian: GUARDIAN_CONTACT_SELECT` to `enrollment.user.select`; `studentEmail: contactOf(r.enrollment.user).email,` and `parentName: contactOf(r.enrollment.user).parentName,`.
- `AdminPaymentDetail.student`: add `parentName: string | null;`; add the guardian select; replace `student: r.enrollment.user,` with the same IIFE as above built from `r.enrollment.user`.

`lib/payments/monthly.ts`: change `MatrixEnrollment.student` to:

```ts
  student: { firstName: string; lastName: string; email: string; parentName?: string | null };
```

add `parentName: string | null;` to `MatrixRow` after `studentEmail`, and in the row builder add after `studentEmail: e.student.email,`:

```ts
      parentName: e.student.parentName ?? null,
```

`lib/payments/monthly-queries.ts`: user select becomes `{ firstName: true, lastName: true, email: true, guardian: GUARDIAN_CONTACT_SELECT }` and replace `student: r.user,` with:

```ts
      student: {
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        ...(({ email, parentName }) => ({ email, parentName }))(contactOf(r.user)),
      },
```

- [ ] **Step 7: Notification call sites go through `notificationTarget`**

`lib/purchases/actions.ts`: import `{ NOTIFY_SELECT, notificationTarget } from '@/lib/students/contact'`; change the user select to `{ ...NOTIFY_SELECT, studentType: true, isActive: true }`; replace the email block with:

```ts
  const target = notificationTarget(user)
  try {
    if (target) await sendPurchaseConfirmationEmail({ ...target, purchaseId, payLater })
  } catch (err) {
    console.error('[createPurchase] Email error:', err)
  }
```

`lib/payments/actions.ts`: change the user select to `{ ...NOTIFY_SELECT, isActive: true }`, and replace the email block with:

```ts
  const target = notificationTarget(user);
  try {
    if (target) {
      await sendPaymentConfirmationEmail({
        ...target,
        courseTitle: enrollment.course.title,
      });
    }
  } catch (err) {
    console.error("[createPayment] Email error:", err);
  }
```

`app/(admin)/admin/purchases/[id]/actions.ts`:
- approve: user select becomes `{ id: true, ...NOTIFY_SELECT }`; the send becomes:

```ts
  const target = notificationTarget(purchase.user);
  try {
    if (target) {
      await sendPurchaseApprovalEmail({
        ...target,
        courseNames: purchase.items.map((i) => i.course.title),
      });
    }
  } catch (err) {
```

- reject: select becomes `{ user: { select: NOTIFY_SELECT } }`, and the send becomes `if (target) await sendPurchaseRejectionEmail({ ...target, reason });` with `const target = notificationTarget(purchase.user);` above the `try`.

`app/(admin)/admin/payments/[id]/actions.ts`: both selects of `user: { select: { email: true, firstName: true } }` become `user: { select: NOTIFY_SELECT }`, and each send becomes `if (target) await sendPaymentApprovalEmail({ ...target, courseTitle: payment.enrollment.course.title, paymentStatus })` (respectively `sendPaymentRejectionEmail({ ...target, courseTitle: payment.enrollment.course.title, reason })`) with `const target = notificationTarget(payment.enrollment.user);` above the `try`.

- [ ] **Step 8: `KidNote` and the display sites**

Create `components/students/kid-note.tsx`:

```tsx
// Marks a kid profile wherever staff see a student, and names the parent whose
// email and phone are shown in the kid's place.
export function KidNote({ parentName }: { parentName: string | null }) {
  if (!parentName) return null
  return (
    <span className="text-muted-foreground mt-0.5 block text-xs font-normal">
      <span className="mr-1.5 inline-flex items-center rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-sky-800 uppercase">
        Kid
      </span>
      Parent: {parentName}
    </span>
  )
}
```

Render `<KidNote parentName={...} />` directly under the student's name in:
- `app/(admin)/admin/students/student-table.tsx`: inside the name cell, after `{s.firstName} {s.lastName}`, with `s.parentName`.
- `app/(admin)/admin/courses/[id]/course-roster.tsx`: after the name `</Link>`, with `r.parentName`.
- `app/(teacher)/teacher/subjects/[sid]/students/page.tsx`: after `{s.lastName}, {s.firstName}`, with `s.parentName`.
- `app/(admin)/admin/purchases/page.tsx`: after `{r.studentName}` (wrap the cell content so the note stacks under the name).
- `app/(admin)/admin/payments/page.tsx`: after `<p className="font-medium">{r.studentName}</p>`.
- `app/(admin)/admin/payments/monthly/monthly-matrix.tsx`: after the closing `</p>` of the name, with `row.parentName`.
- `app/(admin)/admin/purchases/[id]/page.tsx` and `app/(admin)/admin/payments/[id]/page.tsx`: directly under the student name heading, with `purchase.student.parentName` / `payment.student.parentName`.

`app/(admin)/admin/students/[id]/page.tsx`: change the Email and Contact number `dt` labels to show whose they are:

```tsx
              <dt className="text-muted-foreground">Email{student.parentName && ' (parent)'}</dt>
```

```tsx
              <dt className="text-muted-foreground">Contact number{student.parentName && ' (parent)'}</dt>
```

`app/api/admin/students/export/route.ts`: append a `Parent` column at the end of the header (`...,Enrolled Date,Status,Parent\r\n`), compute `const parent = csvField(s.parentName ?? '')`, and append `parent` as the last element of the row array. Appending keeps every existing column in place for admins' saved spreadsheets.

- [ ] **Step 9: Pin the kid case in the purchase action test**

Append to the `describe` in `lib/__tests__/purchases/create-pay-later.test.ts`:

```ts
  it("sends a kid's confirmation to the parent and names the kid", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      email: null,
      firstName: "Ana",
      guardian: { firstName: "Raffi", email: "raffi@example.com" },
      studentType: "NEW",
      isActive: true,
    } as never);

    await expect(
      createPurchaseAction(
        { error: null },
        form({ courseIds: "c1", paymentType: "PARTIAL", payLater: "on" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(sendPurchaseConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "raffi@example.com",
        firstName: "Raffi",
        learnerFirstName: "Ana",
      }),
    );
  });
```

- [ ] **Step 10: Typecheck, test, lint**

Run: `./node_modules/.bin/tsc --noEmit && pnpm vitest run && pnpm lint`
Expected: tsc silent; all tests pass; lint 6 warnings, 0 errors.

- [ ] **Step 11: Commit**

```bash
git add prisma/schema.prisma prisma/migrations components/students/kid-note.tsx lib app
git commit -m "feat(students): allow kid profiles without email and show their parent to staff"
```

---

### Task 3: Session resolves the active kid profile

**Files:**
- Create: `lib/auth/profile.ts`
- Modify: `lib/auth/session.ts`
- Modify: `app/change-password/actions.ts`
- Test: `lib/__tests__/auth/session.test.ts`

**Interfaces:**
- Produces:
  - `ACTIVE_PROFILE_COOKIE = 'active_profile'`
  - `setActiveProfile(kidId: string | null): Promise<void>` (sets or deletes the cookie)
  - `getAccountSession(): Promise<{ userId: string; role: UserRole } | null>` (the logged-in account)
  - `getSession()` unchanged signature, now returns the active learner.

- [ ] **Step 1: Rewrite the test file's mocks and add the failing tests**

In `lib/__tests__/auth/session.test.ts`, replace the `next/headers` and `@/lib/db` mocks and imports with:

```ts
const mockHeaders = vi.hoisted(() => new Map<string, string>())
const cookieJar = vi.hoisted(() => ({
  values: new Map<string, string>(),
  set: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => mockHeaders.get(k) ?? null }),
  cookies: async () => ({
    get: (k: string) => (cookieJar.values.has(k) ? { value: cookieJar.values.get(k)! } : undefined),
    set: cookieJar.set,
    delete: cookieJar.delete,
  }),
}))

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  // Bypass request-scoped memoization so each test sees a fresh lookup.
  cache: <T>(fn: T) => fn,
}))

vi.mock('@/lib/db', () => ({
  db: { user: { findUnique: vi.fn(), findFirst: vi.fn() } },
}))

import { db } from '@/lib/db'
import { clearSession, createSession, getAccountSession, getSession } from '@/lib/auth/session'
```

Replace the `beforeEach` with:

```ts
beforeEach(() => {
  vi.mocked(db.user.findUnique).mockReset()
  vi.mocked(db.user.findFirst).mockReset()
  cookieJar.values.clear()
  cookieJar.set.mockReset()
  cookieJar.delete.mockReset()
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long'
})
```

Append:

```ts
describe('getSession active kid profile', () => {
  function asStudent() {
    forwardIdentity({ id: 'u1', role: 'STUDENT', tokenVersion: '3' })
    vi.mocked(db.user.findUnique).mockResolvedValue({ tokenVersion: 3 } as never)
  }

  it('resolves to the kid when the cookie names an active kid of this account', async () => {
    asStudent()
    cookieJar.values.set('active_profile', 'k1')
    vi.mocked(db.user.findFirst).mockResolvedValue({ id: 'k1' } as never)

    expect(await getSession()).toEqual({ userId: 'k1', role: 'STUDENT' })
    expect(db.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'k1', guardianId: 'u1', isActive: true },
      select: { id: true },
    })
  })

  it('falls back to the account for a kid that is not theirs, inactive, or gone', async () => {
    asStudent()
    cookieJar.values.set('active_profile', 'someone-elses-kid')
    vi.mocked(db.user.findFirst).mockResolvedValue(null as never)

    expect(await getSession()).toEqual({ userId: 'u1', role: 'STUDENT' })
  })

  it('is the account when no profile is selected, without an extra lookup', async () => {
    asStudent()

    expect(await getSession()).toEqual({ userId: 'u1', role: 'STUDENT' })
    expect(db.user.findFirst).not.toHaveBeenCalled()
  })

  it('ignores the cookie for staff', async () => {
    forwardIdentity({ id: 'a1', role: 'ADMIN', tokenVersion: '0' })
    vi.mocked(db.user.findUnique).mockResolvedValue({ tokenVersion: 0 } as never)
    cookieJar.values.set('active_profile', 'k1')

    expect(await getSession()).toEqual({ userId: 'a1', role: 'ADMIN' })
    expect(db.user.findFirst).not.toHaveBeenCalled()
  })

  it('rejects a stale token even while a kid is selected', async () => {
    forwardIdentity({ id: 'u1', role: 'STUDENT', tokenVersion: '3' })
    vi.mocked(db.user.findUnique).mockResolvedValue({ tokenVersion: 4 } as never)
    cookieJar.values.set('active_profile', 'k1')

    expect(await getSession()).toBeNull()
    expect(db.user.findFirst).not.toHaveBeenCalled()
  })

  it('getAccountSession ignores the selected kid', async () => {
    asStudent()
    cookieJar.values.set('active_profile', 'k1')
    vi.mocked(db.user.findFirst).mockResolvedValue({ id: 'k1' } as never)

    expect(await getAccountSession()).toEqual({ userId: 'u1', role: 'STUDENT' })
  })
})

describe('profile cookie lifecycle', () => {
  it('a new login starts as the account holder', async () => {
    await createSession({ id: 'u2', role: 'STUDENT', email: 'b@example.com', mustChangePassword: false, tokenVersion: 0 })
    expect(cookieJar.delete).toHaveBeenCalledWith('active_profile')
  })

  it('signing out forgets the selected kid', async () => {
    await clearSession()
    expect(cookieJar.delete).toHaveBeenCalledWith('session')
    expect(cookieJar.delete).toHaveBeenCalledWith('active_profile')
  })
})
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `pnpm vitest run lib/__tests__/auth/session.test.ts`
Expected: the five original tests PASS; the new ones FAIL (`getAccountSession` is not exported, cookie never deleted).

- [ ] **Step 3: Create `lib/auth/profile.ts`**

```ts
import { cookies } from 'next/headers'

// Which kid profile a parent is currently studying as. Not signed: getSession
// only honours it after checking in the database that the kid belongs to the
// logged-in account, so a forged value can only resolve to the account itself.
export const ACTIVE_PROFILE_COOKIE = 'active_profile'

export async function setActiveProfile(kidId: string | null) {
  const cookieStore = await cookies()
  if (!kidId) {
    cookieStore.delete(ACTIVE_PROFILE_COOKIE)
    return
  }
  cookieStore.set(ACTIVE_PROFILE_COOKIE, kidId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
}
```

- [ ] **Step 4: Update `lib/auth/session.ts`**

Add the import:

```ts
import { ACTIVE_PROFILE_COOKIE } from './profile'
```

Add a type above `createSession`:

```ts
type Session = { userId: string; role: UserRole }
```

In `createSession`, after `cookieStore.set('session', ...)`, add:

```ts
  // Every login starts as the account holder, never as a kid a previous user
  // of this browser had selected.
  cookieStore.delete(ACTIVE_PROFILE_COOKIE)
```

In `clearSession`, after `cookieStore.delete('session')`, add:

```ts
  cookieStore.delete(ACTIVE_PROFILE_COOKIE)
```

Rename the existing exported `getSession` to `getAccountSession`, change its return type to `Promise<Session | null>`, and update its leading comment's first line to say it returns the logged-in account, ignoring any selected kid profile.
Then add below it:

```ts
// One lookup per request, like currentTokenVersion.
const activeDependentId = cache(async (guardianId: string, kidId: string): Promise<string | null> => {
  const kid = await db.user.findFirst({
    where: { id: kidId, guardianId, isActive: true },
    select: { id: true },
  })
  return kid?.id ?? null
})

// The learner the student portal is acting as: the kid the parent selected,
// when that kid belongs to this account and is active, otherwise the account.
// Every student page and action reads its user from here, which is what makes
// them all work for a kid unchanged. Account-level actions (password, managing
// kids, switching) use getAccountSession instead.
//
// An invalid cookie is ignored rather than cleared: server components cannot
// write cookies, and falling back to the account is already safe.
export async function getSession(): Promise<Session | null> {
  const account = await getAccountSession()
  if (!account || account.role !== 'STUDENT') return account

  const kidId = (await cookies()).get(ACTIVE_PROFILE_COOKIE)?.value
  if (!kidId) return account

  const learnerId = await activeDependentId(account.userId, kidId)
  return learnerId ? { userId: learnerId, role: 'STUDENT' } : account
}
```

- [ ] **Step 5: Change-password acts on the account**

In `app/change-password/actions.ts`, change the import to `import { getAccountSession, createSession } from '@/lib/auth/session'` and `const session = await getSession()` to `const session = await getAccountSession()`.

- [ ] **Step 6: Run tests and typecheck**

Run: `pnpm vitest run lib/__tests__/auth && ./node_modules/.bin/tsc --noEmit`
Expected: all PASS, tsc silent.

- [ ] **Step 7: Commit**

```bash
git add lib/auth/profile.ts lib/auth/session.ts app/change-password/actions.ts lib/__tests__/auth/session.test.ts
git commit -m "feat(auth): resolve the selected kid profile in getSession"
```

---

### Task 4: Kid profile rules (`createDependent`, `updateDependent`, `removeDependent`)

**Files:**
- Create: `lib/students/dependents.ts`
- Test: `lib/__tests__/students/dependents.test.ts`

**Interfaces:**
- Produces:
  - `type KidActionState = { error: string | null; success?: boolean }`
  - `type KidListItem = { id: string; firstName: string; lastName: string; gender: 'MALE' | 'FEMALE' | null; isActive: boolean; hasHistory: boolean }`
  - `parseDependentForm(formData: FormData): { ok: true; data: DependentInput } | { ok: false; error: string }`
  - `DependentInput = { firstName: string; lastName: string; gender: 'MALE' | 'FEMALE' }`
  - `DependentResult = { ok: true; id: string } | { ok: false; error: string }`
  - `createDependent(guardianId: string, input: DependentInput): Promise<DependentResult>`
  - `updateDependent(guardianId: string, kidId: string, input: DependentInput): Promise<DependentResult>`
  - `removeDependent(guardianId: string, kidId: string): Promise<DependentResult>`

- [ ] **Step 1: Write the failing tests**

`lib/__tests__/students/dependents.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import {
  createDependent,
  parseDependentForm,
  removeDependent,
  updateDependent,
} from '@/lib/students/dependents'

const ana = { firstName: 'Ana', lastName: 'Muloc', gender: 'FEMALE' as const }

function form(fields: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

beforeEach(() => vi.clearAllMocks())

describe('parseDependentForm', () => {
  it('trims and accepts a complete kid', () => {
    expect(parseDependentForm(form({ firstName: ' Ana ', lastName: 'Muloc', gender: 'FEMALE' }))).toEqual({
      ok: true,
      data: ana,
    })
  })

  it('requires a gender, since gender-restricted subjects hide from a null gender', () => {
    expect(parseDependentForm(form({ firstName: 'Ana', lastName: 'Muloc' }))).toEqual({
      ok: false,
      error: 'Gender is required.',
    })
  })

  it('requires a first name', () => {
    expect(parseDependentForm(form({ firstName: '  ', lastName: 'Muloc', gender: 'FEMALE' }))).toEqual({
      ok: false,
      error: 'First name is required.',
    })
  })
})

describe('createDependent', () => {
  it('creates a STUDENT with no email, owned by the guardian, as a new student', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ role: 'STUDENT', isActive: true, guardianId: null } as never)
    vi.mocked(db.user.create).mockResolvedValue({ id: 'k1' } as never)

    expect(await createDependent('p1', ana)).toEqual({ ok: true, id: 'k1' })
    expect(db.user.create).toHaveBeenCalledWith({
      data: { ...ana, role: 'STUDENT', guardianId: 'p1', studentType: 'NEW' },
      select: { id: true },
    })
  })

  it.each([
    ['a kid', { role: 'STUDENT', isActive: true, guardianId: 'p0' }],
    ['staff', { role: 'TEACHER', isActive: true, guardianId: null }],
    ['a missing account', null],
  ])('refuses %s as a guardian', async (_label, guardian) => {
    vi.mocked(db.user.findUnique).mockResolvedValue(guardian as never)

    expect(await createDependent('p1', ana)).toEqual({ ok: false, error: 'This account cannot add kids.' })
    expect(db.user.create).not.toHaveBeenCalled()
  })

  it('refuses an inactive guardian', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ role: 'STUDENT', isActive: false, guardianId: null } as never)

    expect(await createDependent('p1', ana)).toEqual({ ok: false, error: 'This account is inactive.' })
  })
})

describe('updateDependent', () => {
  it('only updates a kid of this guardian', async () => {
    vi.mocked(db.user.updateMany).mockResolvedValue({ count: 1 } as never)

    expect(await updateDependent('p1', 'k1', ana)).toEqual({ ok: true, id: 'k1' })
    expect(db.user.updateMany).toHaveBeenCalledWith({ where: { id: 'k1', guardianId: 'p1' }, data: ana })
  })

  it("reports another family's kid as not found", async () => {
    vi.mocked(db.user.updateMany).mockResolvedValue({ count: 0 } as never)

    expect(await updateDependent('p1', 'k9', ana)).toEqual({ ok: false, error: 'Kid not found.' })
  })
})

describe('removeDependent', () => {
  it('deletes a kid with no history', async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue({ _count: { purchases: 0, enrollments: 0 } } as never)

    expect(await removeDependent('p1', 'k1')).toEqual({ ok: true, id: 'k1' })
    expect(db.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'k1', guardianId: 'p1' } }),
    )
    expect(db.user.delete).toHaveBeenCalledWith({ where: { id: 'k1' } })
  })

  it.each([
    [{ purchases: 1, enrollments: 0 }],
    [{ purchases: 0, enrollments: 1 }],
  ])('keeps a kid with history %o', async (_count) => {
    vi.mocked(db.user.findFirst).mockResolvedValue({ _count } as never)

    const result = await removeDependent('p1', 'k1')
    expect(result.ok).toBe(false)
    expect(db.user.delete).not.toHaveBeenCalled()
  })

  it('reports a delete that loses a race with a new purchase as an error, not a crash', async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue({ _count: { purchases: 0, enrollments: 0 } } as never)
    vi.mocked(db.user.delete).mockRejectedValue(new Error('foreign key'))

    expect((await removeDependent('p1', 'k1')).ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run lib/__tests__/students/dependents.test.ts`
Expected: FAIL, cannot resolve `@/lib/students/dependents`.

- [ ] **Step 3: Implement `lib/students/dependents.ts`**

```ts
import { z } from 'zod'
import { db } from '@/lib/db'

// A kid profile is a STUDENT user with no email or password, managed by the
// parent account in guardianId. The parent's /student/kids page and the admin
// student page both go through these functions, so both enforce one set of rules.

export type KidActionState = { error: string | null; success?: boolean }

// One kid as the parent's kids page and the admin student page list it.
export type KidListItem = {
  id: string
  firstName: string
  lastName: string
  gender: 'MALE' | 'FEMALE' | null
  isActive: boolean
  // Has purchases or enrollments, so it can no longer be removed.
  hasHistory: boolean
}

const dependentSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(100, 'First name is too long.'),
  lastName: z.string().trim().min(1, 'Last name is required.').max(100, 'Last name is too long.'),
  // Required, as at registration: a gender-restricted subject is hidden from a
  // student with no gender, so an optional field would hide part of a course.
  gender: z.enum(['MALE', 'FEMALE'], { error: 'Gender is required.' }),
})

export type DependentInput = z.infer<typeof dependentSchema>
export type DependentResult = { ok: true; id: string } | { ok: false; error: string }

export function parseDependentForm(
  formData: FormData,
): { ok: true; data: DependentInput } | { ok: false; error: string } {
  const result = dependentSchema.safeParse({
    firstName: formData.get('firstName') ?? '',
    lastName: formData.get('lastName') ?? '',
    gender: formData.get('gender') ?? undefined,
  })
  if (!result.success) return { ok: false, error: result.error.issues[0]?.message ?? 'Invalid details.' }
  return { ok: true, data: result.data }
}

export async function createDependent(guardianId: string, input: DependentInput): Promise<DependentResult> {
  const guardian = await db.user.findUnique({
    where: { id: guardianId },
    select: { role: true, isActive: true, guardianId: true },
  })
  // One level only: a kid cannot have kids, and staff accounts are not parents.
  if (!guardian || guardian.role !== 'STUDENT' || guardian.guardianId) {
    return { ok: false, error: 'This account cannot add kids.' }
  }
  if (!guardian.isActive) return { ok: false, error: 'This account is inactive.' }

  try {
    const kid = await db.user.create({
      data: { ...input, role: 'STUDENT', guardianId, studentType: 'NEW' },
      select: { id: true },
    })
    return { ok: true, id: kid.id }
  } catch (err) {
    console.error('[createDependent]', err)
    return { ok: false, error: 'A database error occurred. Please try again.' }
  }
}

export async function updateDependent(
  guardianId: string,
  kidId: string,
  input: DependentInput,
): Promise<DependentResult> {
  try {
    // Scoped by guardianId, so a parent can only ever edit their own kids.
    const { count } = await db.user.updateMany({ where: { id: kidId, guardianId }, data: input })
    if (count === 0) return { ok: false, error: 'Kid not found.' }
    return { ok: true, id: kidId }
  } catch (err) {
    console.error('[updateDependent]', err)
    return { ok: false, error: 'A database error occurred. Please try again.' }
  }
}

// Only a kid with no purchases or enrollments can be removed. After that the
// profile carries payment and grade history that must stay auditable.
export async function removeDependent(guardianId: string, kidId: string): Promise<DependentResult> {
  const kid = await db.user.findFirst({
    where: { id: kidId, guardianId },
    select: { _count: { select: { purchases: true, enrollments: true } } },
  })
  if (!kid) return { ok: false, error: 'Kid not found.' }
  if (kid._count.purchases > 0 || kid._count.enrollments > 0) {
    return { ok: false, error: 'This kid already has enrollments or purchases, so the profile cannot be removed.' }
  }

  try {
    await db.user.delete({ where: { id: kidId } })
    return { ok: true, id: kidId }
  } catch (err) {
    // A purchase created between the check and the delete trips the foreign key.
    console.error('[removeDependent]', err)
    return { ok: false, error: 'This profile could not be removed. Please refresh and try again.' }
  }
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm vitest run lib/__tests__/students/dependents.test.ts && ./node_modules/.bin/tsc --noEmit`
Expected: PASS, tsc silent.

- [ ] **Step 5: Commit**

```bash
git add lib/students/dependents.ts lib/__tests__/students/dependents.test.ts
git commit -m "feat(students): rules for adding, editing and removing kid profiles"
```

---

### Task 5: Parent actions: add, edit, remove kids, and switch profiles

**Files:**
- Create: `lib/students/dependent-actions.ts`
- Test: `lib/__tests__/students/dependent-actions.test.ts`

**Interfaces:**
- Consumes: `getAccountSession` (Task 3), `setActiveProfile` (Task 3), `parseDependentForm`, `createDependent`, `updateDependent`, `removeDependent`, `KidActionState` (Task 4).
- Produces (all `'use server'`):
  - `switchProfileAction(formData: FormData): Promise<void>` (form field `kidId`, empty for the account holder)
  - `addKidAction(prev: KidActionState, formData: FormData): Promise<KidActionState>`
  - `updateKidAction(prev: KidActionState, formData: FormData): Promise<KidActionState>` (form field `kidId`)
  - `removeKidAction(prev: KidActionState, formData: FormData): Promise<KidActionState>` (form field `kidId`)

- [ ] **Step 1: Write the failing tests**

`lib/__tests__/students/dependent-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ db: { user: { findFirst: vi.fn() } } }))
vi.mock('@/lib/auth/session', () => ({ getAccountSession: vi.fn() }))
vi.mock('@/lib/auth/profile', () => ({ setActiveProfile: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))
vi.mock('@/lib/students/dependents', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/students/dependents')>()),
  createDependent: vi.fn(),
  updateDependent: vi.fn(),
  removeDependent: vi.fn(),
}))

import { db } from '@/lib/db'
import { getAccountSession } from '@/lib/auth/session'
import { setActiveProfile } from '@/lib/auth/profile'
import { createDependent, removeDependent, updateDependent } from '@/lib/students/dependents'
import {
  addKidAction,
  removeKidAction,
  switchProfileAction,
  updateKidAction,
} from '@/lib/students/dependent-actions'

function form(fields: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

const kid = { firstName: 'Ana', lastName: 'Muloc', gender: 'FEMALE' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAccountSession).mockResolvedValue({ userId: 'p1', role: 'STUDENT' })
})

describe('switchProfileAction', () => {
  it('selects an active kid of this account and goes to the dashboard', async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue({ id: 'k1' } as never)

    await expect(switchProfileAction(form({ kidId: 'k1' }))).rejects.toThrow('NEXT_REDIRECT /student/dashboard')
    expect(db.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'k1', guardianId: 'p1', isActive: true },
      select: { id: true },
    })
    expect(setActiveProfile).toHaveBeenCalledWith('k1')
  })

  it("refuses another family's kid by switching back to the account", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(null as never)

    await expect(switchProfileAction(form({ kidId: 'k9' }))).rejects.toThrow('NEXT_REDIRECT')
    expect(setActiveProfile).toHaveBeenCalledWith(null)
  })

  it('switches back to the account holder on an empty kidId', async () => {
    await expect(switchProfileAction(form({ kidId: '' }))).rejects.toThrow('NEXT_REDIRECT /student/dashboard')
    expect(setActiveProfile).toHaveBeenCalledWith(null)
    expect(db.user.findFirst).not.toHaveBeenCalled()
  })

  it('sends a non-student to login', async () => {
    vi.mocked(getAccountSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' })

    await expect(switchProfileAction(form({ kidId: 'k1' }))).rejects.toThrow('NEXT_REDIRECT /login')
    expect(setActiveProfile).not.toHaveBeenCalled()
  })
})

describe('addKidAction', () => {
  it('creates the kid under the logged-in account, selects it, and opens the catalog', async () => {
    vi.mocked(createDependent).mockResolvedValue({ ok: true, id: 'k1' })

    await expect(addKidAction({ error: null }, form(kid))).rejects.toThrow('NEXT_REDIRECT /student/courses')
    expect(createDependent).toHaveBeenCalledWith('p1', kid)
    expect(setActiveProfile).toHaveBeenCalledWith('k1')
  })

  it('returns a validation error without creating anything', async () => {
    const result = await addKidAction({ error: null }, form({ firstName: 'Ana', lastName: 'Muloc' }))

    expect(result).toEqual({ error: 'Gender is required.' })
    expect(createDependent).not.toHaveBeenCalled()
  })

  it('rejects staff', async () => {
    vi.mocked(getAccountSession).mockResolvedValue({ userId: 't1', role: 'TEACHER' })

    expect(await addKidAction({ error: null }, form(kid))).toEqual({ error: 'Unauthorized' })
  })
})

describe('updateKidAction and removeKidAction', () => {
  it('scopes an edit to the logged-in account', async () => {
    vi.mocked(updateDependent).mockResolvedValue({ ok: true, id: 'k1' })

    expect(await updateKidAction({ error: null }, form({ ...kid, kidId: 'k1' }))).toEqual({ error: null, success: true })
    expect(updateDependent).toHaveBeenCalledWith('p1', 'k1', kid)
  })

  it('scopes a removal to the logged-in account and passes its refusal through', async () => {
    vi.mocked(removeDependent).mockResolvedValue({ ok: false, error: 'has history' })

    expect(await removeKidAction({ error: null }, form({ kidId: 'k1' }))).toEqual({ error: 'has history' })
    expect(removeDependent).toHaveBeenCalledWith('p1', 'k1')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run lib/__tests__/students/dependent-actions.test.ts`
Expected: FAIL, cannot resolve `@/lib/students/dependent-actions`.

- [ ] **Step 3: Implement `lib/students/dependent-actions.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getAccountSession } from '@/lib/auth/session'
import { setActiveProfile } from '@/lib/auth/profile'
import {
  createDependent,
  parseDependentForm,
  removeDependent,
  updateDependent,
  type KidActionState,
} from '@/lib/students/dependents'

// Kids belong to the logged-in account, never to whichever profile is selected,
// so every action here reads getAccountSession rather than getSession.
async function studentAccount() {
  const account = await getAccountSession()
  return account?.role === 'STUDENT' ? account : null
}

function kidIdFrom(formData: FormData): string {
  return String(formData.get('kidId') ?? '')
}

export async function switchProfileAction(formData: FormData): Promise<void> {
  const account = await studentAccount()
  if (!account) redirect('/login')

  const kidId = kidIdFrom(formData)
  if (!kidId) {
    await setActiveProfile(null)
  } else {
    // Same check getSession makes, so the cookie never names someone else's kid.
    const kid = await db.user.findFirst({
      where: { id: kidId, guardianId: account.userId, isActive: true },
      select: { id: true },
    })
    await setActiveProfile(kid?.id ?? null)
  }
  // The dashboard, not the current page: the current page may be an
  // enrollment or attempt that belongs only to the previous profile.
  redirect('/student/dashboard')
}

export async function addKidAction(_prev: KidActionState, formData: FormData): Promise<KidActionState> {
  const account = await studentAccount()
  if (!account) return { error: 'Unauthorized' }

  const parsed = parseDependentForm(formData)
  if (!parsed.ok) return { error: parsed.error }

  const result = await createDependent(account.userId, parsed.data)
  if (!result.ok) return { error: result.error }

  // A parent adds a kid to enroll them, so land on the catalog as that kid.
  await setActiveProfile(result.id)
  redirect('/student/courses')
}

export async function updateKidAction(_prev: KidActionState, formData: FormData): Promise<KidActionState> {
  const account = await studentAccount()
  if (!account) return { error: 'Unauthorized' }

  const parsed = parseDependentForm(formData)
  if (!parsed.ok) return { error: parsed.error }

  const result = await updateDependent(account.userId, kidIdFrom(formData), parsed.data)
  if (!result.ok) return { error: result.error }

  // The layout shows kids' names in the profile menu.
  revalidatePath('/student', 'layout')
  return { error: null, success: true }
}

export async function removeKidAction(_prev: KidActionState, formData: FormData): Promise<KidActionState> {
  const account = await studentAccount()
  if (!account) return { error: 'Unauthorized' }

  const result = await removeDependent(account.userId, kidIdFrom(formData))
  if (!result.ok) return { error: result.error }

  revalidatePath('/student', 'layout')
  return { error: null, success: true }
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm vitest run lib/__tests__/students && ./node_modules/.bin/tsc --noEmit`
Expected: PASS, tsc silent.

- [ ] **Step 5: Commit**

```bash
git add lib/students/dependent-actions.ts lib/__tests__/students/dependent-actions.test.ts
git commit -m "feat(students): parent actions to manage kids and switch profiles"
```

---

### Task 6: Student portal UI: profile menu, viewing strip, kids page, checkout banner

**Files:**
- Modify: `app/(student)/layout.tsx`
- Modify: `components/student/nav.tsx`
- Create: `components/student/profile-menu.tsx`
- Create: `components/students/kid-form.tsx`
- Create: `components/students/kid-list.tsx`
- Create: `app/(student)/student/kids/page.tsx`
- Modify: `app/(student)/student/checkout/page.tsx`

**Interfaces:**
- Consumes: `getSession`, `getAccountSession` (Task 3); `switchProfileAction`, `addKidAction`, `updateKidAction`, `removeKidAction` (Task 5); `KidActionState`, `KidListItem` (Task 4).
- Produces (reused by Task 7):
  - `KidForm({ action, submitLabel, hidden?, defaults?, onSuccess? })`
  - `KidList({ kids, updateAction, removeAction, hidden?, linkBase? })` where `kids: KidListItem[]`

- [ ] **Step 1: `KidForm`**

`components/students/kid-form.tsx`:

```tsx
'use client'

import { useActionState, useEffect, useId } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { KidActionState } from '@/lib/students/dependents'

type Props = {
  action: (prev: KidActionState, formData: FormData) => Promise<KidActionState>
  submitLabel: string
  hidden?: Record<string, string>
  defaults?: { firstName: string; lastName: string; gender: 'MALE' | 'FEMALE' | null }
  onSuccess?: () => void
}

// Shared by the parent's kids page and the admin student page.
export function KidForm({ action, submitLabel, hidden, defaults, onSuccess }: Props) {
  const [state, formAction, isPending] = useActionState(action, { error: null })
  // Unique per instance: a page renders one form per kid being edited plus the add form.
  const uid = useId()

  useEffect(() => {
    if (state.success) onSuccess?.()
  }, [state, onSuccess])

  return (
    <form action={formAction} className="space-y-3">
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-firstName`}>First name</Label>
          <Input id={`${uid}-firstName`} name="firstName" required defaultValue={defaults?.firstName} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-lastName`}>Last name</Label>
          <Input id={`${uid}-lastName`} name="lastName" required defaultValue={defaults?.lastName} />
        </div>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Gender</legend>
        <div className="flex gap-4 text-sm">
          {(['MALE', 'FEMALE'] as const).map((g) => (
            <label key={g} className="flex items-center gap-2">
              <input type="radio" name="gender" value={g} required defaultChecked={defaults?.gender === g} />
              {g === 'MALE' ? 'Male' : 'Female'}
            </label>
          ))}
        </div>
      </fieldset>
      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? 'Saving...' : submitLabel}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: `KidList`**

`components/students/kid-list.tsx`:

```tsx
'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { KidForm } from '@/components/students/kid-form'
import type { KidActionState, KidListItem } from '@/lib/students/dependents'

type Action = (prev: KidActionState, formData: FormData) => Promise<KidActionState>

type Props = {
  kids: KidListItem[]
  updateAction: Action
  removeAction: Action
  hidden?: Record<string, string>
  // Admin only: makes each name a link to that kid's student page.
  linkBase?: string
}

export function KidList({ kids, updateAction, removeAction, hidden, linkBase }: Props) {
  if (kids.length === 0) return <p className="text-muted-foreground text-sm">No kids yet.</p>
  return (
    <ul className="divide-y rounded-lg border">
      {kids.map((kid) => (
        <KidRow key={kid.id} kid={kid} updateAction={updateAction} removeAction={removeAction} hidden={hidden} linkBase={linkBase} />
      ))}
    </ul>
  )
}

function KidRow({ kid, updateAction, removeAction, hidden, linkBase }: Omit<Props, 'kids'> & { kid: KidListItem }) {
  const [editing, setEditing] = useState(false)
  const [removeState, removeFormAction, removing] = useActionState(removeAction, { error: null })
  const name = `${kid.firstName} ${kid.lastName}`
  const fields = { ...hidden, kidId: kid.id }

  return (
    <li className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">
            {linkBase ? (
              <Link href={linkBase + kid.id} className="hover:underline">
                {name}
              </Link>
            ) : (
              name
            )}
          </p>
          {!kid.isActive && <p className="text-muted-foreground text-xs">Deactivated by the academy</p>}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Cancel' : 'Edit'}
          </Button>
          {!kid.hasHistory && (
            <form action={removeFormAction}>
              {Object.entries(fields).map(([n, v]) => (
                <input key={n} type="hidden" name={n} value={v} />
              ))}
              <Button type="submit" variant="outline" size="sm" disabled={removing} className="text-destructive hover:text-destructive">
                {removing ? 'Removing...' : 'Remove'}
              </Button>
            </form>
          )}
        </div>
      </div>
      {removeState.error && <p className="text-destructive text-sm">{removeState.error}</p>}
      {editing && (
        <KidForm
          action={updateAction}
          submitLabel="Save"
          hidden={fields}
          defaults={{ firstName: kid.firstName, lastName: kid.lastName, gender: kid.gender }}
          onSuccess={() => setEditing(false)}
        />
      )}
    </li>
  )
}
```

`onSuccess={() => setEditing(false)}` is a new function each render; `KidForm`'s effect depends on `state`, which only changes after a submit, so it runs once per result. That is the intended behavior.

- [ ] **Step 3: Kids page**

`app/(student)/student/kids/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { getAccountSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { KidForm } from '@/components/students/kid-form'
import { KidList } from '@/components/students/kid-list'
import { addKidAction, removeKidAction, updateKidAction } from '@/lib/students/dependent-actions'

export const metadata = { title: 'My Kids - AQA' }

export default async function KidsPage() {
  // The account's kids, even while one of them is the selected profile.
  const account = await getAccountSession()
  if (!account || account.role !== 'STUDENT') redirect('/login')

  const kids = await db.user.findMany({
    where: { guardianId: account.userId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      gender: true,
      isActive: true,
      _count: { select: { purchases: true, enrollments: true } },
    },
  })

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight">My Kids</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Add a profile for each child you enroll. Switch to their profile from the menu at the top to enroll them,
        join their classes, watch recordings and take quizzes for them.
      </p>

      <section className="mt-6">
        <KidList
          kids={kids.map(({ _count, ...k }) => ({ ...k, hasHistory: _count.purchases + _count.enrollments > 0 }))}
          updateAction={updateKidAction}
          removeAction={removeKidAction}
        />
        <p className="text-muted-foreground mt-2 text-xs">
          A kid who has enrolled or purchased a course cannot be removed. Contact the academy if you need changes.
        </p>
      </section>

      <section className="mt-8 rounded-xl border p-4">
        <h2 className="mb-3 font-semibold">Add a kid</h2>
        <KidForm action={addKidAction} submitLabel="Add kid" />
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Profile menu**

`components/student/profile-menu.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { switchProfileAction } from '@/lib/students/dependent-actions'

type Props = {
  self: { firstName: string }
  kids: { id: string; firstName: string }[]
  activeKidId: string | null
}

// Always visible, including on mobile where the other nav links are hidden, so
// a parent can add their first kid from any device.
export function ProfileMenu({ self, kids, activeKidId }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = kids.find((k) => k.id === activeKidId)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const profiles = [{ id: '', firstName: self.firstName }, ...kids]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10"
      >
        <span className="max-w-32 truncate">{active?.firstName ?? self.firstName}</span>
        <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border bg-white py-1 text-sm shadow-lg">
          <p className="text-muted-foreground px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide uppercase">Studying as</p>
          {profiles.map((p) => {
            const selected = (p.id || null) === activeKidId
            return (
              <form key={p.id || 'self'} action={switchProfileAction}>
                <input type="hidden" name="kidId" value={p.id} />
                <button
                  type="submit"
                  role="menuitemradio"
                  aria-checked={selected}
                  className="hover:bg-muted flex w-full items-center justify-between px-3 py-2 text-left"
                >
                  <span className="truncate">{p.id ? p.firstName : `${p.firstName} (me)`}</span>
                  {selected && <span className="text-primary text-xs font-medium">Current</span>}
                </button>
              </form>
            )
          })}
          <div className="my-1 border-t" />
          <Link href="/student/kids" role="menuitem" onClick={() => setOpen(false)} className="hover:bg-muted block px-3 py-2">
            Manage kids
          </Link>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Nav and layout**

`components/student/nav.tsx`: change the signature to accept the profile props and render the menu and the strip:

```tsx
import { ProfileMenu } from './profile-menu'

type Props = {
  self: { firstName: string }
  kids: { id: string; firstName: string }[]
  activeKidId: string | null
}

export function StudentNav({ self, kids, activeKidId }: Props) {
  const viewing = kids.find((k) => k.id === activeKidId)
```

Insert `<ProfileMenu self={self} kids={kids} activeKidId={activeKidId} />` immediately before `<SignOutButton ... />`.
After the closing `</div>` of the `h-16` bar (still inside `<header>`, so it stays sticky), add:

```tsx
      {viewing && (
        <div className="border-t border-amber-200 bg-amber-100 px-6 py-2 text-sm text-amber-900 md:px-10">
          You&apos;re viewing <strong>{viewing.firstName}</strong>&apos;s classes. Switch profiles from the menu above.
        </div>
      )}
```

`app/(student)/layout.tsx`: replace the body of `StudentLayout` with:

```tsx
  const [account, session] = await Promise.all([getAccountSession(), getSession()])
  if (!account || !session || account.role !== 'STUDENT') redirect('/login')

  // isActive is re-checked on every student page load: sessions are stateless
  // 7-day JWTs, so an admin deactivating a student mid-session would otherwise
  // not take effect until the token expired. It is the account that is checked;
  // getSession already resolves only active kids.
  const user = await db.user.findUnique({
    where: { id: account.userId },
    select: {
      firstName: true,
      isActive: true,
      dependents: { where: { isActive: true }, orderBy: { createdAt: 'asc' }, select: { id: true, firstName: true } },
    },
  })
  if (!user?.isActive) redirect('/login')

  const activeKidId = session.userId === account.userId ? null : session.userId

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <StudentNav self={{ firstName: user.firstName }} kids={user.dependents} activeKidId={activeKidId} />
      <main className="flex-1">{children}</main>
    </div>
  )
```

and change the session import to `import { getAccountSession, getSession } from '@/lib/auth/session'`.

- [ ] **Step 6: Checkout banner**

`app/(student)/student/checkout/page.tsx` (double quotes, semicolons): change the session import to `import { getAccountSession, getSession } from "@/lib/auth/session";`, add `import { db } from "@/lib/db";`, and replace `const session = await getSession();` with:

```tsx
  const [session, account] = await Promise.all([getSession(), getAccountSession()]);
```

After `if (courses.length === 0) redirect("/student/courses");` add:

```tsx
  // Checkout always buys for the selected profile. Say so when that is a kid,
  // so a parent never pays for the wrong person.
  const learner =
    account && session.userId !== account.userId
      ? await db.user.findUnique({ where: { id: session.userId }, select: { firstName: true } })
      : null;
```

and render, directly under the `<p>` subtitle:

```tsx
      {learner && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Enrolling for <strong>{learner.firstName}</strong>. To enroll someone else, switch profiles from the menu at the top.
        </p>
      )}
```

- [ ] **Step 7: Typecheck, test, lint**

Run: `./node_modules/.bin/tsc --noEmit && pnpm vitest run && pnpm lint`
Expected: tsc silent; all PASS; lint 6 warnings, 0 errors.

- [ ] **Step 8: Commit**

```bash
git add components/student components/students app/\(student\)
git commit -m "feat(student): profile menu, kids page and checkout banner for kid profiles"
```

---

### Task 7: Admin: Guardian and Kids cards, admin kid actions

**Files:**
- Modify: `lib/students/queries.ts` (`StudentDetail`, `getStudentById`)
- Modify: `app/(admin)/admin/students/actions.ts`
- Modify: `app/(admin)/admin/students/[id]/page.tsx`
- Test: `lib/__tests__/students/admin-kid-actions.test.ts`

**Interfaces:**
- Consumes: `parseDependentForm`, `createDependent`, `updateDependent`, `removeDependent`, `KidActionState`, `KidListItem` (Task 4); `KidForm`, `KidList` (Task 6).
- Produces:
  - `StudentDetail.guardian: { id: string; firstName: string; lastName: string } | null`
  - `StudentDetail.dependents: KidListItem[]`
  - `addKidAdminAction`, `updateKidAdminAction`, `removeKidAdminAction`, each `(prev: KidActionState, formData: FormData) => Promise<KidActionState>`, reading form fields `guardianId` and (for update and remove) `kidId`.

- [ ] **Step 1: Write the failing tests**

`lib/__tests__/students/admin-kid-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ db: { user: { findUnique: vi.fn(), update: vi.fn() } } }))
vi.mock('@/lib/auth/session', () => ({ getSession: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/students/dependents', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/students/dependents')>()),
  createDependent: vi.fn(),
  updateDependent: vi.fn(),
  removeDependent: vi.fn(),
}))

import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import { createDependent, removeDependent, updateDependent } from '@/lib/students/dependents'
import {
  addKidAdminAction,
  removeKidAdminAction,
  updateKidAdminAction,
} from '@/app/(admin)/admin/students/actions'

function form(fields: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

const kid = { firstName: 'Ana', lastName: 'Muloc', gender: 'FEMALE' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' })
})

describe('admin kid actions', () => {
  it('adds a kid to the given parent and refreshes both student pages', async () => {
    vi.mocked(createDependent).mockResolvedValue({ ok: true, id: 'k1' })

    expect(await addKidAdminAction({ error: null }, form({ ...kid, guardianId: 'p1' }))).toEqual({ error: null, success: true })
    expect(createDependent).toHaveBeenCalledWith('p1', kid)
    expect(revalidatePath).toHaveBeenCalledWith('/admin/students/p1')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/students')
  })

  it('rejects a teacher', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 't1', role: 'TEACHER' })

    expect(await addKidAdminAction({ error: null }, form({ ...kid, guardianId: 'p1' }))).toEqual({ error: 'Forbidden' })
    expect(createDependent).not.toHaveBeenCalled()
  })

  it('edits and removes scoped to the parent named in the form', async () => {
    vi.mocked(updateDependent).mockResolvedValue({ ok: true, id: 'k1' })
    vi.mocked(removeDependent).mockResolvedValue({ ok: true, id: 'k1' })

    await updateKidAdminAction({ error: null }, form({ ...kid, guardianId: 'p1', kidId: 'k1' }))
    await removeKidAdminAction({ error: null }, form({ guardianId: 'p1', kidId: 'k1' }))

    expect(updateDependent).toHaveBeenCalledWith('p1', 'k1', kid)
    expect(removeDependent).toHaveBeenCalledWith('p1', 'k1')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/students/k1')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run lib/__tests__/students/admin-kid-actions.test.ts`
Expected: FAIL, the three actions are not exported.

- [ ] **Step 3: Implement the admin actions**

Append to `app/(admin)/admin/students/actions.ts`:

```ts
import {
  createDependent,
  parseDependentForm,
  removeDependent,
  updateDependent,
  type KidActionState,
} from '@/lib/students/dependents'
```

(place that import with the others at the top), then add at the end:

```ts
async function isAdmin(): Promise<boolean> {
  const session = await getSession()
  return session?.role === 'ADMIN' || session?.role === 'SUPER_ADMIN'
}

// For walk-ins: an admin adds a kid to a parent's account from the parent's
// student page. The same rules as the parent's own form apply.
function revalidateFamily(guardianId: string, kidId?: string) {
  revalidatePath('/admin/students')
  revalidatePath('/admin/students/' + guardianId)
  if (kidId) revalidatePath('/admin/students/' + kidId)
}

export async function addKidAdminAction(_prev: KidActionState, formData: FormData): Promise<KidActionState> {
  if (!(await isAdmin())) return { error: 'Forbidden' }
  const guardianId = String(formData.get('guardianId') ?? '')
  const parsed = parseDependentForm(formData)
  if (!parsed.ok) return { error: parsed.error }

  const result = await createDependent(guardianId, parsed.data)
  if (!result.ok) return { error: result.error }
  revalidateFamily(guardianId)
  return { error: null, success: true }
}

export async function updateKidAdminAction(_prev: KidActionState, formData: FormData): Promise<KidActionState> {
  if (!(await isAdmin())) return { error: 'Forbidden' }
  const guardianId = String(formData.get('guardianId') ?? '')
  const kidId = String(formData.get('kidId') ?? '')
  const parsed = parseDependentForm(formData)
  if (!parsed.ok) return { error: parsed.error }

  const result = await updateDependent(guardianId, kidId, parsed.data)
  if (!result.ok) return { error: result.error }
  revalidateFamily(guardianId, kidId)
  return { error: null, success: true }
}

export async function removeKidAdminAction(_prev: KidActionState, formData: FormData): Promise<KidActionState> {
  if (!(await isAdmin())) return { error: 'Forbidden' }
  const guardianId = String(formData.get('guardianId') ?? '')
  const kidId = String(formData.get('kidId') ?? '')

  const result = await removeDependent(guardianId, kidId)
  if (!result.ok) return { error: result.error }
  revalidateFamily(guardianId, kidId)
  return { error: null, success: true }
}
```

- [ ] **Step 4: Run to verify the tests pass**

Run: `pnpm vitest run lib/__tests__/students`
Expected: PASS (including the existing `toggle-active.test.ts`).

- [ ] **Step 5: Extend `getStudentById`**

In `lib/students/queries.ts`, add `import type { KidListItem } from '@/lib/students/dependents'`, then add to `StudentDetail`:

```ts
  // Set on a kid: the parent account that manages it.
  guardian: { id: string; firstName: string; lastName: string } | null
  // Set on a parent: the kid profiles they manage.
  dependents: KidListItem[]
```

In `getStudentById`'s select, replace `guardian: GUARDIAN_CONTACT_SELECT,` with:

```ts
      guardian: { select: { ...GUARDIAN_CONTACT_SELECT.select, id: true } },
      dependents: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          gender: true,
          isActive: true,
          _count: { select: { purchases: true, enrollments: true } },
        },
      },
```

and add to the returned object:

```ts
    guardian: user.guardian
      ? { id: user.guardian.id, firstName: user.guardian.firstName, lastName: user.guardian.lastName }
      : null,
    dependents: user.dependents.map(({ _count, ...k }) => ({
      ...k,
      hasHistory: _count.purchases + _count.enrollments > 0,
    })),
```

- [ ] **Step 6: Guardian and Kids cards on the admin student page**

In `app/(admin)/admin/students/[id]/page.tsx`, add the imports:

```tsx
import Link from 'next/link'
import { KidForm } from '@/components/students/kid-form'
import { KidList } from '@/components/students/kid-list'
import { addKidAdminAction, removeKidAdminAction, updateKidAdminAction } from '../actions'
```

Wrap the existing Profile sidebar `<div className="border rounded-lg p-4 space-y-3 self-start">...</div>` in a `<div className="space-y-6 self-start">`, move `self-start` off the inner card, and add after the Profile card, inside the wrapper:

```tsx
          {student.guardian ? (
            <div className="border rounded-lg p-4 space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Guardian</h2>
              <p className="text-sm">
                Kid profile managed by{' '}
                <Link href={`/admin/students/${student.guardian.id}`} className="text-primary font-medium hover:underline">
                  {student.guardian.firstName} {student.guardian.lastName}
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="border rounded-lg p-4 space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Kids</h2>
              <KidList
                kids={student.dependents}
                updateAction={updateKidAdminAction}
                removeAction={removeKidAdminAction}
                hidden={{ guardianId: student.id }}
                linkBase="/admin/students/"
              />
              <details className="text-sm">
                <summary className="text-primary cursor-pointer font-medium">Add kid</summary>
                <div className="mt-3">
                  <KidForm action={addKidAdminAction} submitLabel="Add kid" hidden={{ guardianId: student.id }} />
                </div>
              </details>
            </div>
          )}
```

For a kid (`student.guardian` set), hide the Address and Facebook/Messenger rows of the Profile card, since a kid has neither; wrap each of those two `<div>`s in `{!student.guardian && (...)}`.

- [ ] **Step 7: Typecheck, test, lint**

Run: `./node_modules/.bin/tsc --noEmit && pnpm vitest run && pnpm lint`
Expected: tsc silent; all PASS; lint 6 warnings, 0 errors.

- [ ] **Step 8: Commit**

```bash
git add lib/students/queries.ts app/\(admin\)/admin/students lib/__tests__/students/admin-kid-actions.test.ts
git commit -m "feat(admin): manage a parent's kids and link kids to their guardian"
```

---

### Task 8: End-to-end verification in the running app

**Files:**
- Temporary only: `.tmp-kids-e2e.ts` in the repo root (deleted at the end).

The database is live production. Before writing anything, stop and ask the user:
1. which existing student account to use as the test parent;
2. which course a test kid may be enrolled in (a draft course is preferred);
3. permission to create, then delete, a test kid, purchase and enrollment.

- [ ] **Step 1: Start or reuse the dev server**

Check `ss -ltnp | grep 3000`.
If nothing is listening, start it with the sandbox disabled: `NODE_OPTIONS=--network-family-autoselection-attempt-timeout=3000 pnpm dev` (background). Restart it if it was started before Task 2's `prisma generate`.

- [ ] **Step 2: Drive the walkthrough with a Playwright script**

Write `.tmp-kids-e2e.ts` that mints a `session` cookie for the test parent with `signToken` from `@/lib/auth/jwt` (see the e2e-screenshot-workflow memory), and run it with `NODE_OPTIONS=--network-family-autoselection-attempt-timeout=3000 pnpm exec tsx --env-file=.env .tmp-kids-e2e.ts` with the sandbox disabled.
Pass `page.evaluate` bodies as strings (tsx injects `__name`).
Cover, taking screenshots at 1280px and 390px widths:

1. `/student/dashboard`: the profile menu shows the parent's first name; open it and screenshot.
2. `/student/kids`: submit the add form without a gender and confirm the browser blocks it; then add "Test Kid" with a gender; confirm the redirect to `/student/courses`, the amber strip, and the menu label.
3. Checkout for the agreed course: confirm "Enrolling for Test Kid", submit with pay later.
4. As an admin (mint a second cookie): `/admin/purchases` shows the row with the Kid note; approve it; confirm the email went to the parent (check server logs for the send, or the Resend dashboard if the user prefers).
5. As the parent viewing the kid: the course appears on the dashboard; open it and a recording page.
6. Switch to the parent: the kid's course is not on the parent's dashboard.
7. Admin: the parent's student page shows the Kids card with Test Kid linked; the kid's page shows the Guardian card and "(parent)" labels; the course roster shows the Kid note.
8. Set `active_profile` to a random cuid in the browser context and load `/student/dashboard`: it shows the parent with no strip.

Look hard at every screenshot for layout problems (overflow of the menu at 390px, strip wrapping, alignment of the Kid note in each table) and fix any you find before continuing.

- [ ] **Step 3: Clean up**

With the user's agreement, delete the test enrollment, purchase, payments and kid created in Step 2 (use the admin UI where possible; otherwise a short tsx script, shown to the user before running).
Delete `.tmp-kids-e2e.ts` and any screenshots outside the scratchpad.

- [ ] **Step 4: Final checks**

Run: `./node_modules/.bin/tsc --noEmit && pnpm vitest run && pnpm lint && git status --short`
Expected: tsc silent; all PASS; lint 6 warnings, 0 errors; no stray files.

- [ ] **Step 5: Commit any fixes from Step 2**

```bash
git add -A -- app components lib
git commit -m "fix(student): polish kid profile UI found in end-to-end review"
```

(Skip if Step 2 found nothing.)
