# Kids profiles under a parent account

## Purpose

AQA runs programs for kids, online and on-site, but kids cannot run the LMS themselves.
A parent with an existing student account needs to enroll their kid and then use the student portal on the kid's behalf: join online classes, watch recordings, track lesson progress and take quizzes.
Rosters, grades and certificates must carry the kid's name, not the parent's.

## Scope

- A parent (any `STUDENT` account without a guardian) can add kids to their account.
- A kid is a real `STUDENT` user with no email and no password, linked to the parent through `guardianId`.
- The parent switches the student portal between themselves and each kid.
While viewing a kid, every student page and action works as that kid.
- Admins can add and edit kids on a parent's account, for walk-in enrollments.
- Emails about a kid's purchases and payments go to the parent.
- Admin and teacher screens mark kids and show the parent's contact details.

Out of scope:

- Admin-side direct enrollment without checkout.
A walk-in kid is still enrolled by the parent checking out as the kid, then an admin approving the purchase.
- Converting a kid into a full login account.
Nothing in this design blocks it: it would mean setting an email and password on the kid's user.
- Multi-level guardianship.
A kid cannot have kids.

## Data model

```prisma
model User {
  email        String? @unique   // was required; null for kids
  passwordHash String?           // was required; null for kids
  guardianId   String?
  guardian     User?   @relation("Guardianship", fields: [guardianId], references: [id])
  dependents   User[]  @relation("Guardianship")

  @@index([guardianId])
}
```

- A kid has `role = STUDENT`, a non-null `guardianId`, and null `email` and `passwordHash`.
- Postgres allows many null values under a unique index, so kids need no placeholder emails.
- A kid stores only first name, last name and optional gender.
Address, contact number and Facebook details come from the guardian wherever they are displayed.
- No other table changes.
Enrollments, purchases, payments, grades, attempts, lesson completions and certificates stay keyed by `userId`, which is the kid's id when the kid is the learner.

Rules enforced in application code:

1. A guardian must be an active `STUDENT` whose own `guardianId` is null.
2. A kid's `guardianId` never changes after creation.
3. A kid can be removed only while it has no purchases and no enrollments.
After that, the parent is told to contact the admin.

Migration: add nullable `guardianId` with its index and foreign key, and drop `NOT NULL` on `email` and `passwordHash`.
No backfill.

## Session and profile switching

### Active profile cookie

- Cookie name `active_profile`, value is a kid's user id.
- `httpOnly`, `sameSite=lax`, `secure` in production, `path=/`, max age 7 days to match the session.
- The cookie is not signed.
The database check below is the authority, so a forged value can only resolve to the account holder.

### `getSession()`

`getSession()` in `lib/auth/session.ts` returns:

```ts
{ userId: string; role: UserRole; accountUserId: string }
```

- `accountUserId` is the logged-in user from the JWT.
- `userId` is the active learner.
It is the kid's id when all of these hold, and `accountUserId` otherwise:
  1. the account role is `STUDENT`;
  2. the `active_profile` cookie is present;
  3. a user with that id exists, has `guardianId === accountUserId`, and is active.
- The `tokenVersion` check runs against `accountUserId`.
A password change on the parent still revokes every session, including while viewing a kid.
- Resolution is wrapped in React `cache` so a render does at most one extra lookup.
- An invalid cookie is ignored, not cleared, because server components cannot write cookies.

Every existing caller keeps reading `userId` and therefore works for the kid with no change.
Server actions posted from student pages pass through `proxy.ts`, so they get the same identity.

Callers that must act on the account holder switch to `accountUserId`:

- change password;
- managing kids (`/student/kids` and its actions);
- the profile switch action itself.

The student layout re-checks `isActive` for both `accountUserId` and `userId`.

### Switch action

- `switchProfileAction(kidId | null)` re-validates ownership with the same rules, sets or deletes the cookie, and redirects to `/student/dashboard`.
- Redirecting to the dashboard avoids landing on a page scoped to the previous profile, such as an enrollment or an attempt.
- Login and sign-out both delete the cookie, so every new login starts as the account holder.

### UI

- The student nav shows "Viewing as: **Ana** ▾" once the account has at least one kid.
The menu lists "Me", each kid, "+ Add a kid" and "Manage kids".
- While viewing a kid, a colored strip under the nav reads "You're viewing Ana's classes".
This guards against taking a quiz or submitting a payment as the wrong person.
- Checkout always runs for the active profile.
When the active profile is a kid, checkout shows "Enrolling for Ana".
There is no learner picker inside checkout, so the checkout code path is unchanged and each purchase belongs to exactly one learner.

## Managing kids

Shared logic lives in `lib/students/dependents.ts`:

- `createDependent(guardianId, { firstName, lastName, gender })`
- `updateDependent(kidId, { firstName, lastName, gender })`
- `removeDependent(kidId)`

Each validates the rules from the data model section and is used by both the parent and the admin surfaces.

### Parent: `/student/kids`

- Always operates on `accountUserId`, even while viewing a kid.
- Add: first name, last name, optional gender.
After adding, the parent is switched to the new kid.
- Edit: names and gender, since names appear on certificates.
- Remove: only while the kid has no purchases or enrollments.

### Admin

- The admin student page for a guardian gets a Kids card listing each kid, with "Add kid", edit, and remove under the same rules.
- The admin student page for a kid gets a Guardian card linking to the parent.
- Walk-in flow: the parent registers at `/register` if they have no account yet, the admin adds the kid from the parent's page, then the parent checks out as the kid and the admin approves.
Admins cannot create student accounts today (admin Users only creates admins and teachers), and this design does not change that.

## Notifications

A helper `notificationTarget(user)` returns `{ email, firstName }` for the account holder: the user's own when it has an email, otherwise the guardian's.
It is used by all six transactional emails:

- purchase confirmation, approval and rejection;
- payment confirmation, approval and rejection.

When the learner is a kid, the email names the kid, for example "Ana's enrollment in Kids Arabic 1 was approved".

Making `email` nullable makes TypeScript flag every place that assumes a student has an email.
Each flagged site is resolved either through `notificationTarget` or by displaying the guardian's contact details.

## Auth flows

- Login and forgot-password look users up by a typed, non-empty email, so a kid never matches.
No code change, but tests lock it in.
- Registration is unchanged and always creates an account with no guardian.
- Admin Users lists only admins and teachers, so kids never appear there.
- `changePasswordAction` and any other password path operate on `accountUserId`, which is never a kid.

## Admin and teacher display

- Kids appear as regular students in the admin Students list, course rosters, batch rosters and the teacher's students page, with a small "Kid" badge.
- Wherever an email or contact column appears, a kid shows the guardian's details labeled "(parent)".
This covers the student export CSV and the monthly payments view.
- Purchase and payment review pages show "Ana (parent: Raffi Muloc)".

## Testing

Vitest:

- `getSession()` resolution: own kid resolves to the kid; a stranger's kid, a deactivated kid, a missing user, and a non-student account all resolve to the account holder; a stale `tokenVersion` is rejected while viewing a kid.
- `createDependent` rejects a guardian that is a kid, is not a `STUDENT`, or is inactive.
- `removeDependent` is refused once the kid has a purchase or an enrollment.
- `notificationTarget` returns the guardian for a kid and the user for everyone else.
- Login and forgot-password never match a user without an email.

End-to-end in the running app, using the repo-root tsx screenshot workflow:

1. Parent logs in, adds Ana, and lands viewing as Ana.
2. Parent enrolls Ana in a kids course through checkout, which shows "Enrolling for Ana".
3. Admin approves, and the approval email goes to the parent and names Ana.
4. As Ana, the parent opens the course, a recording and a quiz, with the strip visible.
5. Switching to "Me" shows the parent's own dashboard without Ana's courses.
6. Admin sees Ana on the roster with the Kid badge and the parent's contact details, and the Guardian and Kids cards link to each other.
7. Admin adds a second kid from the parent's page, and it appears in the parent's switcher.
8. Forging `active_profile` with another family's kid id silently resolves to the parent.

Screenshots of the switcher, the strip, the kids page and the admin cards at desktop and mobile widths.

## Rollout

- One migration, safe to deploy without backfill.
- Existing students see no change: the switcher appears only once an account has a kid.
