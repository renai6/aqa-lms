# Payment Balance Tracking Design

The additional payments feature let students submit further payments and admins review them, but it deliberately carried no balance math.
`/admin/payments/[id]` shows the amount submitted and the enrollment's current payment status, and then asks the admin to choose Partially paid or Fully paid with nothing on screen to base that on.
The admin is doing arithmetic from memory, or from a chat log, on every review.

This design gives each enrollment an agreed total and turns `Payment` into the complete ledger of money received against it, so the remaining balance is a number the system computes rather than a fact an admin has to remember.

## Goals

- An admin reviewing a payment sees how much the student owes, how much they have paid, and what is left.
- The Partially paid / Fully paid choice defaults to what the balance implies, while remaining the admin's decision.
- A student sees their own outstanding balance, so they know what to pay.
- Enrollments with no agreed total keep working exactly as they do today, with no balance shown and no forced backfill.

## Non-goals

- No billing periods.
Courses with `paymentFrequency` of `MONTHLY` or `YEARLY` are not billed per period by this design.
In practice only fixed-total courses are paid partially, so those enrollments simply go untracked.
- No bulk migration of historical data.
Existing enrollments become tracked one at a time, when an admin next reviews a payment for them.
- No change to how students submit payments, and no online payment gateway.
- No misc fees in the total.
`Course.miscFeeNote` is free text and stays that way.
If misc fees are part of the agreed amount, the admin includes them in the total they type.

## Data model

One column on `Enrollment` for what is owed, and two on `Payment` for what a row is and where it came from.

```prisma
enum PaymentSource {
  SUBMITTED // uploaded by the student through /student/payments
  CHECKOUT  // recorded by an admin at purchase approval, or as a catch-up
}

model Enrollment {
  // The agreed total for this enrollment, set by an admin.
  // Null means the balance is not tracked, which is the pre-existing behavior.
  totalDue Decimal?
}

model Payment {
  source     PaymentSource @default(SUBMITTED)
  // Provenance, when the money came in through a Purchase. Nullable because
  // an enrollment need not have one.
  purchaseId String?
  purchase   Purchase?     @relation(fields: [purchaseId], references: [id])
}
```

`Purchase` gains the `payments Payment[]` back-relation, and `Payment` gains a `@@index([purchaseId])`.

`source` and `purchaseId` answer different questions and neither substitutes for the other.
`source` says whether a human student submitted this row for review, which is what the admin queue filters on.
`purchaseId` says which purchase the money arrived with, which is provenance and is legitimately null for an enrollment created without one.
Inferring the first from the second was the tempting shortcut, and it puts rows into the review queue whenever an enrollment has no purchase.

The default of `SUBMITTED` is correct for every row that exists today, since all of them are student submissions.

### Why the checkout payment becomes a Payment row

Money received for an enrollment lives in exactly one place: approved `Payment` rows.
The balance is `totalDue - sum(approved payments)`, one formula, readable from one table on every surface.

The alternative was leaving the checkout payment in `Purchase.amountPaid` and summing two sources everywhere.
That works, but it means every future surface that touches money has to remember both, and the one that forgets produces a wrong number silently.

The original additional-payments spec avoided writing checkout payments into `Payment` because backfilling historical purchases carried real migration risk against the shared production database.
This design does not backfill.
It writes a `Payment` row only for purchases approved from here on, so historical rows are untouched and that risk does not arise.
`Purchase.amountPaid` keeps its current meaning and is still the record of what was paid at checkout.

### Migration

Per the project's Prisma workflow, the user runs `pnpm prisma migrate dev --name add_payment_balance` in their own terminal, then the agent runs `pnpm prisma generate`.
`totalDue` and `purchaseId` are nullable and `source` carries a default, so the migration is additive and needs no data step against existing rows.

## Allocation at purchase approval

A purchase can contain several courses but records one `amountPaid`.
Payments are per enrollment, so that amount has to be attributed before it can reduce a balance.

`approvePurchaseAction` currently creates enrollments from a bare Approve button.
The button becomes a small form with one row per course in the purchase:

| Column | Prefilled with | Editable |
| --- | --- | --- |
| Course | the course title | no |
| Total due | `tuitionFee` when `paymentFrequency` is `ONE_TIME` or null, otherwise blank | yes, and may be left blank |
| Amount applied | this course's share of `amountPaid` | yes |

The prefill for Amount applied comes from a pure `allocate(amountPaid, fees)` in `lib/purchases/allocation.ts`:

- When every course in the purchase has a `tuitionFee`, split proportionally by fee, rounded to two decimals, with the rounding remainder given to the highest-fee course so the shares reconcile exactly.
- When any fee is missing, split evenly.

The prefill is a convenience, not a claim of truth.
A student who hands over money earmarked for one course is common enough that the admin must be able to say so, and a purely automatic split would record a wrong balance on both courses with no way to correct it.

`approvePurchaseAction` validates server-side that the applied amounts sum to exactly `amountPaid` and refuses the approval otherwise, with the mismatch stated in the error.
Silently accepting a total that does not reconcile would put the ledger permanently out of step with the money actually received.

Inside the existing transaction, for each course, alongside the enrollment it already creates, the action creates:

```
Payment {
  enrollmentId: <the new enrollment>
  purchaseId:   <this purchase>
  amount:       <the applied amount>
  proofUrl:     <the purchase's paymentProofUrl>
  status:       APPROVED
  source:       CHECKOUT
  reviewedById: <the approving admin>
  reviewedAt:   now
}
```

and sets the enrollment's `totalDue` to the entered total, or null if left blank.

The `proofUrl` is reused rather than copied, so the checkout proof image is reachable from the ledger row without duplicating the file in storage.

## Balance computation

One pure function in `lib/payments/balance.ts`, used by every surface:

```ts
export type Balance =
  | { kind: "untracked" }
  | { kind: "tracked"; totalDue: number; paid: number; remaining: number };

export function computeBalance(
  totalDue: number | null,
  approvedAmounts: number[],
): Balance;
```

`remaining` is `totalDue - paid` and is not clamped.
A negative value means the student overpaid, and admins need to see that rather than a zero.

Rendering rules, shared by a `BalanceSummary` component in `components/admin/balance-summary.tsx`:

- `untracked`: "Balance not tracked", with no numbers.
- `remaining > 0`: "₱8,000 of ₱20,000 paid. ₱12,000 remaining."
- `remaining === 0`: "Fully paid. ₱20,000 of ₱20,000."
- `remaining < 0`: "Overpaid by ₱500."

## Admin surfaces

### Payments queue

`/admin/payments` gains a Balance column on the Pending tab, so the admin can triage without opening each row.
`getAdminPaymentsByStatus` selects the enrollment's `totalDue` and its approved payment amounts.

The queue filters to `source: SUBMITTED` on every tab, and `getPaymentStatusCounts` applies the same filter so the tab counts match the rows beneath them.
Checkout payments belong in a student's history, not in a review queue for submissions that need a decision.

### Payment detail

`/admin/payments/[id]` gains, above the approve form:

- The balance summary for the enrollment as it stands now, before this payment.
- What the balance becomes if this payment is approved.

The Partially paid / Fully paid radio in `approve-form.tsx` defaults to `FULLY_PAID` when approving this payment would bring `remaining` to zero or below, and `PARTIALLY_PAID` otherwise.
It stays a radio the admin can change.
Deriving the status outright would be wrong: a student can settle the last of a balance in cash offline, and the admin is the one who knows.

`approvePaymentAction` keeps taking the status from the form.
Its comment about there being no balance math anywhere in the feature is removed, since that is no longer true.

### Starting to track an existing enrollment

Every enrollment that exists today has `totalDue` null and no checkout `Payment` row, so it would stay untracked forever.
That is the entire population this feature is meant to serve, so the payment detail page offers a way in.

When the enrollment's `totalDue` is null, the approve form shows two extra fields before the status radio:

- **Total due**, prefilled from the course's `tuitionFee` when it is a fixed-total course.
- **Already paid before this payment**, prefilled with the enrollment's share of `Purchase.amountPaid` via the same `allocate` function.

On approval, the action sets `totalDue` and creates one catch-up `Payment` row carrying the already-paid amount, marked `APPROVED` with `source: CHECKOUT`, in the same transaction.
It takes its `purchaseId` and `proofUrl` from the enrollment's originating purchase when there is one, so the row keeps a link to the original proof image.
When the enrollment has no purchase, both are left null and empty, and `source` alone still keeps the row out of the review queue.
From that point the enrollment is tracked like any other, and the two extra fields no longer appear.

Both fields may be left blank, which keeps the enrollment untracked and preserves today's behavior for anyone who does not want to use this.

## Student surface

The dashboard Payment section (`app/(student)/student/dashboard/page.tsx`) currently renders the fixed text "Partial payment — balance outstanding" for each partially paid enrollment.
Where a balance is tracked, that line is replaced with the real number: "₱12,000 remaining of ₱20,000."
Untracked enrollments keep the existing text, minus the em dash, which does not match the punctuation used elsewhere in the app.

The payment form at `/student/payments/[enrollmentId]` shows the same remaining balance above the amount field, so a student settling up can enter the right figure.
The amount is not pre-filled and not validated against the balance.
Students overpay and underpay for real reasons, and rejecting a payment the student has already sent would be worse than recording it.

## Edge cases

- **Course fee changes after enrollment.**
`totalDue` is a snapshot taken at approval, so raising a course's price does not silently increase what an existing student owes.
This is the main reason the total is stored rather than read from `Course.tuitionFee` at display time.
- **Purchase approved for a student already enrolled.**
`approvePurchaseAction` skips enrollment creation when one exists.
It must also skip the `Payment` row and the `totalDue` write in that case, or a re-purchase would double-count against an existing balance.
- **Rejected payments.**
Only `APPROVED` rows count toward `paid`.
Pending and rejected rows never move a balance.
- **A payment approved, then the enrollment status changed by hand.**
`PaymentStatusForm` on the purchase detail page can still flip `paymentStatus` independently of the balance.
The two can disagree, which is intentional: the status is the admin's assertion, the balance is arithmetic.
The balance summary reflects the numbers regardless of the status.
- **Overpayment on a purchase.**
Applied amounts must sum to `amountPaid`, but a course's applied amount may exceed its total due.
That surfaces as an overpaid balance, not an error.

## Testing

The suite is vitest with `@/lib/db` mocked, matching the existing tests under `lib/__tests__/payments/`.

- `lib/__tests__/purchases/allocation.test.ts`: proportional split with equal and unequal fees, even split when a fee is missing, and shares that reconcile exactly to the input when the division does not come out round.
- `lib/__tests__/payments/balance.test.ts`: untracked when `totalDue` is null, tracked with a positive remainder, exactly zero, and negative for overpayment.
- `lib/__tests__/purchases/approve-allocation.test.ts`: approval creates one `CHECKOUT` `Payment` row per enrollment inside the transaction, writes `totalDue`, rejects applied amounts that do not sum to `amountPaid`, and creates no payment row for a course the student is already enrolled in.
- `lib/__tests__/payments/queries.test.ts`: the admin queue and its status counts exclude `CHECKOUT` rows, including one whose `purchaseId` is null.
- `lib/__tests__/payments/approve.test.ts` is extended: approving with a null `totalDue` and the catch-up fields set writes both the total and the catch-up row in one transaction.

Mocked tests cannot prove the new columns exist, so after the migration is applied, verify the real client compiles with `./node_modules/.bin/tsc --noEmit`.

There is no E2E harness in the repo, so the flow is verified in a browser: approve a two-course purchase with an edited split, submit an additional payment as the student, and confirm the admin detail page shows the right remaining balance and defaults the status radio correctly.
