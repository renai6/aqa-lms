# Monthly Payment Tracking Design

`Course.paymentFrequency` has carried a `MONTHLY` value since the course model was written, and nothing downstream has ever read it for tracking purposes.
The balance-tracking design of 2026-08-24 named this gap in its non-goals: courses billed `MONTHLY` or `YEARLY` are not billed per period, and their enrollments simply go untracked.
`getAdminPaymentById` enacts that decision literally, refusing to prefill a `totalDue` when the course is `MONTHLY` or `YEARLY`, because a recurring course has no single agreed total to prefill.

The result is that a monthly course is invisible to the payment system.
`Payment` rows accumulate against the enrollment as an undifferentiated pile of money with no indication of which month any of it settles, and an admin asking "who has paid for September" has nothing to read but timestamps.

This design gives a payment the month it covers, and derives from that a per-course view of who is paid up and who is behind.

## Goals

- An admin picks a monthly course and sees every enrolled student against every month they owe, marked paid, partially paid, or unpaid.
- A student submitting a payment says which month it is for, and an admin can correct that on review.
- A student catching up on several missed months can submit a proof for each of them.
- Courses that are not `MONTHLY` behave exactly as they do today, with no new required fields anywhere in their flow.

## Non-goals

- No yearly period tracking.
`YEARLY` courses stay untracked.
The mechanism generalises, but there is no yearly course in use and building for one would be speculative.
- No automatic invoicing, dunning, or scheduled reminder emails.
The tracker tells an admin who is behind; contacting them stays a human action.
- No backfill that guesses a month for historical payments.
See "Payments with no month" below.
- No change to `Enrollment.totalDue`.
A monthly enrollment has no single agreed total, which is precisely why the existing balance system leaves it null.
- No proration.
A student enrolling on the 28th owes that whole month.

## Data model

One nullable column on `Payment`.

```prisma
model Payment {
  // The Manila calendar month this payment covers, stored as that month's
  // first day. Null for non-monthly courses and for every row predating
  // this field.
  periodMonth DateTime? @db.Date

  @@index([enrollmentId, periodMonth])
}
```

`@db.Date` rather than a timestamp, for the reason `BatchRecording.date` already carries the same annotation.
Vercel runs in UTC while the academy runs on Philippine time, so a month anchor stored as a timestamp is a moment that can fall on either side of the boundary and land the payment in the wrong month.
A date has no time to drift.

Nullable is not a compromise, it is the correct shape.
A payment against a one-time course covers no particular month, and forcing a value there would invent data.
Null means "this payment is not attributed to a month", which is true of every existing row and of every future payment on a non-monthly course.

### The monthly fee is `Course.tuitionFee`

No new fee column.
`tuitionFee` is already the per-month amount for a monthly course: `priceSuffix` renders it as "₱1,500 / month" on the public catalog, the course detail page, and the student cart.
Introducing a second field for the same number would create two sources of truth for what a student owes, and the surfaces reading the wrong one would be wrong silently.

A monthly course with no `tuitionFee` set cannot be scored paid or partial, because there is no amount to compare against.
Its matrix shows the amounts received without a status, and the view flags the course as needing a fee rather than pretending everyone is unpaid.

### Why not extend `totalDue`

The obvious alternative is to keep one number per enrollment and grow it by the monthly fee each month.
It reuses `computeBalance` unchanged and needs no new column on `Payment`.

It also cannot answer the question this design exists to answer.
A single running total says a student is ₱3,000 short; it cannot say whether that is three missed months or one month and a half-paid one, and it cannot distinguish a student who skipped September from one who paid September and stopped in October.
Attribution has to live on the payment, because attribution is a fact about the payment.

## Months owed

An enrollment owes every Manila month from the month of `enrolledAt` through the current Manila month, inclusive.

Accrual stops at `completedAt` or `removedAt`, whichever is set.
A student removed in July owes June and July and nothing after, and the row stays in the matrix so the arrears remain visible and auditable.
This mirrors how `Enrollment.removedAt` is already documented: the row survives so payments, grades, and certificates stay intact.

Accrual is derived, never stored.
There is no schedule table and no job that writes a row when a month turns over.
The set of months owed is a function of `enrolledAt`, the end date, and today, and computing it on read means it cannot fall out of sync with the enrollment.

## Logic: `lib/payments/monthly.ts`

The one place month arithmetic happens, in the same posture as `computeBalance` in `lib/payments/balance.ts`: pure functions, no database access, unit tested directly.
Every surface calls it rather than doing its own arithmetic, so the admin matrix and the student picker cannot disagree about which months are owed.

```ts
// "2026-09". The canonical key for a billing month everywhere in this feature.
export type MonthKey = string;

export function monthsOwed(
  enrolledAt: Date,
  endedAt: Date | null,
  now: Date,
): MonthKey[];

export type MonthStatus =
  | { kind: "paid"; paid: number }
  | { kind: "partial"; paid: number; short: number }
  | { kind: "unpaid" }
  // A course with no tuitionFee: the money is known, the verdict is not.
  | { kind: "unscored"; paid: number };

export function monthStatus(
  monthlyFee: number | null,
  approvedTotal: number,
): MonthStatus;
```

`monthStatus` uses integer-centavo arithmetic, for the reason `computeBalance` documents at length.
Summing floats and comparing to zero leaves residuals like `3.64e-12`, which render as a permanent one-centavo shortfall on a month that settled exactly.
Multiple approved payments against a single month are the normal case here, so the residual risk is higher than it is for a single balance.

Overpayment against a month reads as paid, not as an error.
It is visible in the amount, and clamping or flagging it would be inventing a policy nobody asked for.

### `lib/time/manila.ts`

Small helpers for deriving a `MonthKey` from a `Date` in `Asia/Manila`, and for turning a `MonthKey` back into the `@db.Date` value and a display label.

`lib/batches/name.ts` already owns a Manila formatter, and this design deliberately does not touch it.
It produces a different format ("0926") for a different purpose (a snapshotted batch label that must never be recomputed), and folding two unrelated needs into one helper to avoid a duplicated `Intl.DateTimeFormat` would couple them for no gain.

## Admin surface

A fourth tab on `/admin/payments`, at `?tab=monthly`, beside Pending, Approved, and Rejected.
This is a payments question and admins reviewing payments are already on this page; a separate top-level route would split payment work across two places in the nav.

The tab renders a course picker over the non-archived courses whose `paymentFrequency` is `MONTHLY`, and then a matrix for the selected course.
The picker does not filter on `isPublished`: an unpublished course can still have enrolled students who owe money, and hiding it would hide their arrears.

```
Marhala 1  ·  ₱1,500 / month

 Student            Unassigned   Jun   Jul   Aug   Sep    Behind
 Aisha Rahman            —        ✓     ✓     ✓     ✓        —
 Omar Khalid             —        ✓     ✓     ◐     ✕     2 months · ₱2,200
 Yusuf Mansour       ₱1,500       ✓     ✕     ✕     ✕     3 months · ₱4,500
 Fatima Salim            —        ✓     ✓     ✓     ✕     1 month · ₱1,500

 Paid                             4     3     2     1
 Partial                          0     0     1     0
 Unpaid                           0     1     1     3
```

**Behind** counts every owed month that is not fully settled, partial months included, and sums their shortfalls.
Omar is two months behind for ₱2,200: August is ₱700 short and September is untouched.
Unassigned money is deliberately not netted against the arrears figure, because until someone says which month it covers, it settles nothing.
An unscored month contributes nothing to Behind either, since a course with no fee has no shortfall to compute; the column shows amounts received and the view says the course needs a fee.

Students sort by the arrears amount, descending, so the people who need chasing are at the top rather than wherever the alphabet puts them.

The student column is sticky and the month columns scroll horizontally.
A course running two years produces twenty-four columns, and a matrix that forces the whole page sideways makes the student names unreadable, which is the one thing the admin needs to keep in view.

Each cell carries its exact amount in a `title`, and a cell with payments links to them.
The icons are paired with text in the accessible name rather than standing alone, so the status does not depend on distinguishing a check from a cross.

### Payments with no month

Existing `Payment` rows on monthly courses have no `periodMonth`, and this design does not guess one from `createdAt`.
A payment made on 2 October may well be September's, and a migration that assumes otherwise writes a wrong fact that looks exactly like a right one and is never questioned again.

Instead the matrix carries a leading **Unassigned** column holding those payments.
The money stays visible rather than silently vanishing from the totals, the admin can see at a glance how much history is unattributed, and assigning a month is a deliberate act on the payment detail page.

The same column absorbs any future payment an admin has not yet attributed, so it is a permanent part of the view rather than a migration artifact to remove later.

## Student surface

The payment form at `/student/payments/[enrollmentId]` gains a **Paying for** select, rendered only when the enrollment's course is `MONTHLY`.

Its options are that enrollment's unpaid and partial months, oldest first, plus the following month so a student can pay ahead.
Defaulting to the oldest unsettled month matches what a student catching up almost always intends.

`createPaymentSchema` gains an optional `periodMonth`.
The action requires it when the course is monthly and rejects it when the course is not, so a non-monthly submission cannot acquire a month by posting a crafted form.

The student payments page lists the enrollment's months with their status, so a student can see what they owe before choosing.
This is the one piece of the design that could be cut without breaking anything else: the picker is required for the feature to work, this list is a convenience on top of it.

Non-monthly courses see no change at all.
No new field renders, and their payments continue to write `periodMonth: null`.

## Guard changes

Both rules in `lib/payments/guards.ts` currently break monthly courses, and both are load-bearing for this feature.

### One pending payment per month, not per enrollment

`canAddPayment` rejects a submission when the enrollment already has a `PENDING` payment.
That rule exists for a good reason, documented in `createPaymentAction`: two tabs or a double-click otherwise create two rows for the same money, and approving both double-counts it against `totalDue`.

For a monthly enrollment it is wrong.
A student settling three missed months has three distinct payments with three distinct proofs, and the rule lets them submit one and then wait for an admin before submitting the next.

The rule becomes one pending payment **per `periodMonth`** for monthly enrollments, which preserves exactly the protection it was written for.
Two submissions for September are still the double-count the guard was defending against; September and October are not.

The `SELECT ... FOR UPDATE` lock in `createPaymentAction` stays, and its re-check narrows to the submitted month.

### A monthly enrollment is never settled

`isSettled` falls back to `paymentStatus === "FULLY_PAID"` when the balance is untracked.
Monthly enrollments are untracked by design, and the approve form requires the admin to choose Partially paid or Fully paid on every approval.

An admin choosing Fully paid on a monthly enrollment therefore locks that student out of paying permanently, with the message "This enrollment is already fully paid" and no way forward.
The enrollment is not fully paid; it accrues another month in a few weeks.

Monthly enrollments never read as settled.
`isSettled` needs the course's `paymentFrequency`, which means `GuardEnrollment` grows a `course.paymentFrequency` field and the queries feeding it select one more column.

## Queries: `lib/payments/monthly-queries.ts`

Separate from `lib/payments/queries.ts`, which is already long enough that adding a matrix builder to it would push it past the point of being readable in one sitting.

- `getMonthlyCourses()` returns the non-archived courses with `paymentFrequency: "MONTHLY"`, for the picker.
- `getCourseMonthlyMatrix(courseId)` returns the active enrollments for a course with their approved payments grouped by `periodMonth`, assembled through `lib/payments/monthly.ts` into rows and column tallies.

Only `APPROVED` payments count toward a month, the same rule the balance system enforces.
Pending and rejected payments are not money received.
A pending payment for a month is surfaced separately in the cell, so an admin does not chase a student whose proof is sitting in the review queue.

Enrollment filtering reuses `ACTIVE_ENROLLMENT` for consistency with every other payment query.

## Error handling

- A payment submitted for a month outside the enrollment's owed range, or more than one month ahead, is rejected by the action.
- A monthly course with no `tuitionFee` yields `unscored` months rather than an exception or a matrix of false "unpaid" verdicts.
- An enrollment whose `enrolledAt` is somehow after `now` yields an empty month list rather than an infinite loop, which is the failure mode a naive month-increment loop has.
- Assigning a month to a payment on a non-monthly course is rejected.

## Testing

Vitest, mocking `@/lib/db` where a query is under test, matching the existing `lib/__tests__/payments/` files.

`lib/payments/monthly.ts` is pure and gets direct unit tests:

- A December enrollment read in January returns both months, across the year boundary.
- A month boundary evaluated at 00:30 Manila on the first, which is still the previous month in UTC, returns the Manila month.
- Accrual stops at `removedAt` and at `completedAt`.
- An enrollment created late in a month owes that whole month.
- `enrolledAt` after `now` returns an empty list.
- Exact equality between paid and fee is paid, one centavo under is partial, zero is unpaid.
- Several approved payments summing exactly to the fee are paid, with no float residual.
- Overpayment is paid.
- A null fee is unscored.

Query tests assert the `APPROVED`-only filter and the `ACTIVE_ENROLLMENT` scope, in the style of the existing `queries.test.ts` assertions on `where` clauses.

Guard tests cover the two changes: a second pending payment for a different month is allowed on a monthly enrollment and rejected on a non-monthly one, and a monthly enrollment marked `FULLY_PAID` still accepts payments.

## Migration

One additive migration: a nullable column and an index.
No data is written or rewritten, no existing row changes meaning, and every current surface continues to read what it reads today.
Following the workflow in `2026-07-19-migration-workflow-design.md`.
