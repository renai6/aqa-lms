# Move a student to another course

## Purpose

Admins need to fix placement mistakes, for example a student enrolled in the wrong level (Marhala 1 instead of Marhala 2).
The move must carry the student's money with them and leave an audit trail in the original course.

## Scope

- One admin action that moves one active enrollment from course A to course B.
- No schema change.
- Progress, grades, assessment attempts and lesson completions do not carry over.
The student starts course B at 0%, and course A's academic records stay where they are.

## Rules

Only `ADMIN` and `SUPER_ADMIN` may move a student.

The move is refused, with a specific error message, when any of these holds:

1. The course A enrollment does not exist or is already removed.
2. A certificate has been issued to the student for course A.
3. The student already has an active (not removed) enrollment in course B.
4. Course B does not exist or is archived.
5. Course A and course B have different `paymentFrequency` values.
`null` counts as its own value, so `null` vs `MONTHLY` is a mismatch.
This keeps `Payment.periodMonth` meaningful after the move.
6. The chosen batch does not exist or does not belong to course B.
7. The `totalDue` input, when provided, is not a valid non-negative amount.

## The move

A new server action `moveEnrollmentCourseAction` in `lib/enrollments/actions.ts`, reusing `loadTarget` and the existing `ActionState` shape.

Form fields: `enrollmentId`, `courseId` (destination), `batchId`, `totalDue` (optional, empty means untracked, always `null` when course B is `MONTHLY`).
When course A's `totalDue` is `null` (an enrollment from before balances were tracked), course B's `totalDue` is stored as `null` whatever the form sends.
Its checkout money lives on the purchase, which does not move, so any typed total would overstate the debt.
The action reads course A's `totalDue` inside the transaction to decide this.

Everything below runs in one `db.$transaction`, starting with `SELECT ... FOR UPDATE` on the course A enrollment row, the same locking pattern used in `lib/payments/actions.ts`.
All rule checks that depend on mutable state (removed, certificate, existing B enrollment) are re-checked inside the transaction.

1. Find the student's enrollment in course B, if any.
   - Removed: restore it (`removedAt = null`, `removedReason = null`).
   - Missing: create it.
   - Either way set `batchId`, `totalDue` (from the form, or `null` as described above), `paymentStatus` (copied from course A) and `enrolledAt` (copied from course A).
   - Copying `enrolledAt` keeps the billing start: monthly billing owes every month from `enrolledAt`, so the moved payments stay inside course B's owed range, and a restored course B row does not invent arrears from its old date.
   Course A's `enrolledAt` is read inside the transaction.
   - `purchaseId` on a newly created enrollment stays `null`, because no purchase was made for course B.
2. Re-point every `Payment` row (any status) from the course A enrollment to the course B enrollment.
   Each payment keeps its own `purchaseId`, so money still traces back to the original checkout.
3. Soft-remove the course A enrollment with `removedAt = now()` and `removedReason = "Moved to <course B title>"`, and clear its `totalDue` to `null` in the same update.
   With its payments gone, a kept `totalDue` would make course A read as owing its full tuition.

## Moved-away enrollments

`lib/enrollments/moved.ts` holds the one shared marker: `MOVED_REASON_PREFIX = "Moved to "`, `movedReason(courseTitle)` and `isMovedAway(removedReason)`.
A removed enrollment whose reason starts with the prefix is treated as moved away.
The remove dialog accepts free text, so a reason an admin types by hand starting with "Moved to " is treated the same way; that is accepted rather than adding a column.

- The monthly tracker (`getCourseMonthlyMatrix`) leaves moved-away rows out, because their money now lives on the destination enrollment.
Other removed rows stay, so their arrears remain visible.
- The course roster and the student profile do not render the Restore button for a moved-away row.
- `restoreEnrollmentAction` refuses a moved-away enrollment with "This student was moved to another course. Use Change course to move them back."

## Payment submission race

`createPaymentAction` locks the enrollment row and then re-reads its `removedAt` inside the transaction.
If the enrollment was removed after the earlier read (for example by a course move), the submission is refused with "Enrollment not found." and no pending payment is created on the removed row.

After the transaction, revalidate the student surfaces for both courses and both courses' batches pages.

The new balance is correct with no extra bookkeeping, since `computeBalance` derives it from `totalDue` and the approved payments on the enrollment.

## UI

A new `components/admin/move-enrollment-course-button.tsx`, modelled on `move-enrollment-button.tsx` (same hidden-form and `form={formId}` pattern, same reset-on-open behaviour).

It renders on the two surfaces that list enrollments one per row: the course roster (next to the existing batch "Move" button) and the student profile enrollments table.
The student table lists one row per student, not per enrollment, so it does not get the button.
It is hidden when the enrollment is removed, a certificate exists for it, or there is no course to move to.

Dialog contents:

1. Course picker: non-archived courses other than course A, excluding courses where the student is actively enrolled.
Courses with a different billing type or no batches are shown disabled with the reason, so the admin sees why.
2. Batch picker for the selected course.
3. "Total due" field, pre-filled with course A's `totalDue`.
Hidden for monthly courses, which never store a `totalDue` (purchase approval forces it to `null` too); the action ignores the field for them.
Also hidden when course A is untracked, replaced by one muted line: "This enrollment has no tracked balance, so the new course will not track one either."
4. A warning line: "Progress in <course A> does not carry over."

The trigger reads "Change course" and its accessible name starts with that text: "Change course for <student name>".

The confirm button stays disabled until a course and a batch are chosen.
Server errors show under the button, as in the existing move and remove buttons.

## Testing

Unit tests in `lib/__tests__/enrollments/`, following the existing action test patterns:

- Each refusal rule from the Rules section.
- Create path: no prior course B enrollment.
- Restore path: a removed course B enrollment is reused, keeping its id.
- Payments of every status move to the course B enrollment and the balance is correct afterwards.
- Course A is removed with the expected reason and a cleared `totalDue`, and its progress, grades and attempts are untouched.
- `enrolledAt` is copied from course A on both the create and the restore path.
- An untracked course A keeps course B untracked even when a total is typed.
- Moved-away rows are left out of the monthly tracker and cannot be restored.
- A payment submission is refused when the enrollment was removed before the lock was taken.
- Non-admin callers are rejected.

E2E check as an admin: move a student with an approved payment from one course to another, then confirm that course B appears for the student with the carried-over balance and course A no longer appears.
