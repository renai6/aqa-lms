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
- A kid stores only first name, last name and gender.
Gender is required, as it is at registration: gender-restricted subjects fail closed for a student with no gender, so an optional gender would hide those subjects from the kid.
A kid without their own email shows the guardian's contact details wherever they are displayed.
A linked kid with their own email shows their own.
- No other table changes.
Enrollments, purchases, payments, grades, attempts, lesson completions and certificates stay keyed by `userId`, which is the kid's id when the kid is the learner.

Rules enforced in application code:

1. A guardian must be an active `STUDENT` whose own `guardianId` is null.
2. A kid's `guardianId` is set once, at creation or when an admin links an existing student to a parent, and never changes after that.
3. A kid can be removed only while it has no purchases, no enrollments and no login of its own.
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

`lib/auth/session.ts` exposes two functions with the same return type, `{ userId: string; role: UserRole } | null`:

- `getAccountSession()` is today's `getSession()` body, unchanged: the logged-in user from the JWT, ignoring any selected profile.
- `getSession()` returns the active learner.
Its `userId` is the kid's id when all of these hold, and the account's id otherwise:
  1. the account role is `STUDENT`;
  2. the `active_profile` cookie is present;
  3. a user with that id exists, has `guardianId` equal to the account's id, and is active.
- The `tokenVersion` check runs against the account, inside `getAccountSession()`.
A password change on the parent still revokes every session, including while viewing a kid.
- Resolution is wrapped in React `cache` so a render does at most one extra lookup.
- An invalid cookie is ignored, not cleared, because server components cannot write cookies.

Every existing caller keeps reading `userId` and therefore works for the kid with no change.
Server actions posted from student pages pass through `proxy.ts`, so they get the same identity.

Callers that must act on the account holder switch to `getAccountSession()`:

- change password;
- managing kids (`/student/kids` and its actions);
- the profile switch action itself.

The student layout re-checks `isActive` for the account; `getSession()` already only resolves active kids.

Two functions instead of a third `accountUserId` field keep the session type unchanged, so the ~35 existing test mocks of `getSession` stay valid, and account-level code has to opt in by name.

### Switch action

- `switchProfileAction(kidId | null)` re-validates ownership with the same rules, sets or deletes the cookie, and redirects to `/student/dashboard`.
- Redirecting to the dashboard avoids landing on a page scoped to the previous profile, such as an enrollment or an attempt.
- Login and sign-out both delete the cookie, so every new login starts as the account holder.

### UI

- The student nav always shows a profile menu, labeled with the active profile's first name.
The menu lists the account holder, each active kid, and "Manage kids", which is where kids are added.
It is always visible, including on mobile, so a parent can add their first kid from any device.
- While viewing a kid, a colored strip under the nav reads "You're viewing Ana's classes".
This guards against taking a quiz or submitting a payment as the wrong person.
- Checkout always runs for the active profile.
When the active profile is a kid, checkout shows "Enrolling for Ana".
There is no learner picker inside checkout, so the checkout code path is unchanged and each purchase belongs to exactly one learner.

## Managing kids

Shared logic lives in `lib/students/dependents.ts`:

- `createDependent(guardianId, { firstName, lastName, gender })`
- `updateDependent(guardianId, kidId, { firstName, lastName, gender })`
- `removeDependent(guardianId, kidId)`

Update and remove are scoped by `guardianId`, so a parent can only touch their own kids.

Each validates the rules from the data model section and is used by both the parent and the admin surfaces.

### Parent: `/student/kids`

- Always operates on the account from `getAccountSession()`, even while viewing a kid.
- Add: first name, last name, gender.
After adding, the parent is switched to the new kid and sent to the course catalog to enroll them.
- Edit: names and gender, since names appear on certificates.
- Remove: only while the kid has no purchases or enrollments.

### Admin

- The admin student page for a guardian gets a Kids card listing each kid, with "Add kid", edit, and remove under the same rules.
- The admin student page for a kid gets a Guardian card linking to the parent.
- Walk-in flow: the parent registers at `/register` if they have no account yet, the admin adds the kid from the parent's page, then the parent checks out as the kid and the admin approves.
Admins cannot create student accounts today (admin Users only creates admins and teachers), and this design does not change that.

#### Linking an existing student

An admin can link an existing student account to a parent by the parent's email, from the student's page, using `linkDependent(kidId, guardianEmail)`.
The parent must be an active `STUDENT` with no guardian, the student must have no guardian and no kids of their own, and the two cannot be the same account.
The student keeps their own email and password and logs in as themselves.
A kid with an email cannot be removed, since that would delete a real login account.
Contact details prefer the kid's own email, and only a kid without an email is contacted through the parent.
A linked kid does not see "Manage kids", and the kids page redirects them to the dashboard.

## Notifications

A helper `notificationTargets(user)` returns the addresses an email about a student goes to.
Emails go to the student's own address and to the guardian's.
A linked kid with their own email and their parent both receive them, and a kid without an email reaches only the parent.
It is used by all six transactional emails:

- purchase confirmation, approval and rejection;
- payment confirmation, approval and rejection.

When the learner is a kid, the email names the kid, for example "Ana's enrollment in Kids Arabic 1 was approved".

Making `email` nullable makes TypeScript flag every place that assumes a student has an email.
Each flagged site is resolved either through `notificationTargets` or by displaying the guardian's contact details.

## Auth flows

- Login and forgot-password look users up by a typed, non-empty email, so a kid never matches.
No code change, but tests lock it in.
- Registration is unchanged and always creates an account with no guardian.
- Admin Users lists only admins and teachers, so kids never appear there.
- `changePasswordAction` uses `getAccountSession()`, so it always acts on the account, never a kid.

## Admin and teacher display

- Kids appear as regular students in the admin Students list, course rosters, batch rosters and the teacher's students page, with a small "Kid" badge.
- Wherever an email or contact column appears, a kid without their own email shows the guardian's details labeled "(parent)".
A linked kid with their own email shows their own details, unlabeled, so staff can always tell whose contact they are reading.
This covers the student export CSV and the monthly payments view.
- Purchase and payment review pages show "Ana (parent: Raffi Muloc)".

## Testing

Vitest:

- `getSession()` resolution: own kid resolves to the kid; a stranger's kid, a deactivated kid, a missing user, and a non-student account all resolve to the account holder; a stale `tokenVersion` is rejected while viewing a kid; `getAccountSession()` ignores the cookie.
- `createDependent` rejects a guardian that is a kid, is not a `STUDENT`, or is inactive.
- `removeDependent` is refused once the kid has a purchase or an enrollment.
- `notificationTargets` returns the student's own address and the guardian's, skipping any that is missing.
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
- Existing students see one change: the profile menu with their own name, from which they can add a kid.
