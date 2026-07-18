# Deactivate Student - Design Spec

**Date:** 2026-07-18
**Status:** Approved

## Overview

Give admins a way to remove a student's access to the LMS from the student detail page.

"Delete" here means deactivation, not row removal.
A student record is the anchor for enrollments, purchases, grades, assessment attempts, certificates and lesson completions, and destroying it would destroy the academic and payment history along with it.
Deactivation revokes access while preserving every record, and it is reversible.

The flag already exists: `User.isActive`.
This spec adds the admin control that flips it, and closes the gaps where the flag is currently not enforced.

## Non-Goals

- No hard delete of user rows, and no cascade rules added to the schema.
- No deactivate control in the students list table.
  The action is consequential, so it lives one click into the record rather than on a 200-row table where a misclick is easy.
- No change to how admins and teachers are deactivated.
  That flow already exists on `/admin/users` and is left untouched.

## Schema Changes

None.
`User.isActive` already exists with the right meaning and a default of `true`.
No migration is required.

## Server Action

New file: `app/(admin)/admin/students/actions.ts`

Exports `toggleStudentActiveAction`, closely mirroring `toggleUserActiveAction` in `app/(admin)/admin/users/actions.ts`.

Authorization and validation, in order:

1. Require a session.
   Return `Unauthorized` when absent.
2. Require `session.role` to be `ADMIN` or `SUPER_ADMIN`.
   Return `Forbidden` otherwise.
3. Require a non-empty `userId` in the form data.
4. Look up the target user.
   Return `Student not found.` when missing.
5. Require `target.role === 'STUDENT'`.
   Return `Forbidden.` otherwise.

Step 5 is what keeps this action from becoming a backdoor.
Without it, an admin could pass any user id and deactivate a fellow admin through the student endpoint.
The users-page action already refuses targets that are not `ADMIN` or `TEACHER`, so the two actions are symmetric and neither reaches the other's population.

No self-deactivation guard is needed here, unlike the users action.
An admin is never a `STUDENT`, so step 5 already makes self-targeting impossible.

On success, flip `isActive` to its negation, then `revalidatePath('/admin/students')` and `revalidatePath('/admin/students/' + userId)`.
Database errors are caught, logged under `[toggleStudentActive]`, and returned as a generic retry message, matching the existing convention.

### Why a separate file from `users/actions.ts`

The authorization rules genuinely differ between the two: different permitted target roles, and a self-check that applies to one and not the other.
Collapsing them into a single generic toggle would produce one function whose permission logic branches on its own input, which is the shape that tends to grow holes as rules change.

## UI

### Component

New file: `app/(admin)/admin/students/deactivate-student-button.tsx`, a client component.

Props: `studentId`, `isActive`, `studentName`.
It drives the action with `useActionState`, following `app/(admin)/admin/users/toggle-active-button.tsx`.

Deactivation opens an `AlertDialog` confirmation.
Reactivation does not.
Cutting off a student's access is worth one deliberate beat; restoring it is harmless, and a dialog there would be friction with nothing behind it.

The dialog names the student and states plainly that the record, grades and payments are kept, so the admin is not left guessing whether this is destructive.
`components/ui/alert-dialog.tsx` already exists and needs no additions.

### Placement

`app/(admin)/admin/students/[id]/page.tsx`, in the Profile sidebar, directly beneath the existing Status badge.

```
Profile
──────────────────
Email    jane@x.com
Gender   Female
Status   [Active]
         [ Deactivate ]
Joined   Mar 3, 2026
```

The button reads `Deactivate` when the student is active and `Reactivate` when inactive, with a matching `aria-label` that includes the student's name.
Destructive styling applies only in the `Deactivate` state.

## Enforcement

The flag is only meaningful if something checks it.
Today `app/(auth)/login/actions.ts` is the sole gate, and sessions are stateless JWTs with a seven day lifetime, so a student who is already logged in would keep full access for up to a week after being deactivated.

Three changes close that.

### Student layout

`app/(student)/layout.tsx` already queries the user row on every student page load.
Add `isActive: true` to that existing `select` and `redirect('/login')` when it is false.

This costs zero additional queries and takes effect on the student's next page load.

Enforcement lives here rather than in `proxy.ts` on purpose.
The proxy runs on the Edge runtime, while `lib/db.ts` uses `PrismaClient` with `@prisma/adapter-pg`, which is declared in `serverExternalPackages` and cannot run there.
Making the proxy do this check would mean moving the entire auth hot path to the Node runtime to serve a single boolean.

### Student server actions

Layouts do not re-run for server actions, so a deactivated student holding a stale open tab could still submit work.

Add `assertActiveStudent(session)` to `lib/auth/capabilities.ts`, following the existing `canManageSubject` and `assertCanManageSubject` pattern in that file.
It throws `Forbidden` when the user is missing or `isActive` is false.

Call it from the three student-facing action files:

- `app/(student)/student/courses/[id]/subjects/[sid]/actions.ts`
- `app/(student)/student/courses/[id]/subjects/[sid]/assessments/actions.ts`
- `lib/purchases/actions.ts`

### Login error message

`app/(auth)/login/actions.ts` currently returns "Account not verified. Check your email for a verification link." for every inactive user.
For a student an admin deliberately deactivated, that sends them hunting for an email that will never arrive.

`isActive` does double duty as both "email verified" and "admin enabled," and the login gate cannot distinguish the two, so the message must be true for both:

> This account isn't active. If you just registered, check your email for a verification link; otherwise contact your administrator.

This is a small fix outside a strict reading of the feature, included because the feature is misleading to end users without it.

## Testing

Vitest is already configured.

`toggleStudentActiveAction`:

- Rejects an unauthenticated caller.
- Rejects a `TEACHER` or `STUDENT` caller.
- Rejects a target whose role is not `STUDENT`, covering the cross-population backdoor.
- Returns not-found for an unknown id.
- Flips `isActive` from true to false and from false to true.

`assertActiveStudent`:

- Throws for a deactivated user.
- Resolves for an active one.

## Files Touched

```
docs/superpowers/specs/2026-07-18-deactivate-student-design.md   new  this spec
app/(admin)/admin/students/actions.ts                            new  toggleStudentActiveAction
app/(admin)/admin/students/deactivate-student-button.tsx         new  client component + confirm dialog
app/(admin)/admin/students/[id]/page.tsx                         edit render button in Profile sidebar
app/(student)/layout.tsx                                         edit select isActive, redirect when false
lib/auth/capabilities.ts                                         edit add assertActiveStudent
app/(student)/student/courses/[id]/subjects/[sid]/actions.ts     edit call assertActiveStudent
app/(student)/student/courses/[id]/subjects/[sid]/assessments/actions.ts  edit call assertActiveStudent
lib/purchases/actions.ts                                         edit call assertActiveStudent
app/(auth)/login/actions.ts                                      edit correct the inactive-account message
```
