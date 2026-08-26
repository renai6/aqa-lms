# Pay Later at Checkout

Date: 2026-08-26
Status: Approved for planning

## Problem

Student checkout requires two things before a purchase can be submitted: an amount being paid now, and an uploaded image of the payment proof.
A student who wants a seat but cannot transfer money yet has no way through the flow at all.

We want a "pay later" option at checkout.
When it is chosen the student submits the purchase with no proof and no amount, an admin reviews it like any other purchase, and approving it enrolls the student with the full course total showing as their outstanding balance.

## Scope

In scope:

- A pay-later checkbox on `/student/checkout`, available to every student for every course, with nothing extra required of the student.
- A purchase record that honestly represents "no money received yet".
- Admin review that makes the absence of proof obvious rather than looking like a broken image.
- Enrollment on approval, with balance tracking already in place taking over from there.

Out of scope:

- Due dates, promised payment dates, or free-text reasons captured at checkout.
- Reminders, chasing, or automatic revocation for non-payment.
  An admin removing the student from the course already exists and is the lever for that.
- Per-course or per-student eligibility gating.
  The admin's existing ability to reject a purchase is the only gate.

## Data model

`Purchase.paymentProofUrl` changes from `String` to `String?`.
A pay-later purchase stores `amountPaid: 0` and `paymentProofUrl: null`.

Pay later is derived from the absent proof rather than stored as its own column.
The zero amount follows from it: validation forbids a zero amount on a pay-now purchase, so the two fields cannot disagree.
A stored boolean would be redundant state that can disagree with the columns it summarises: a row could claim `payLater: true` while holding a proof URL, and nothing in the schema would prevent it.
Deriving it makes that state unrepresentable.

The derivation is named once, in `lib/purchases/payment.ts`:

```ts
export function isPayLater(p: { paymentProofUrl: string | null }): boolean {
  return p.paymentProofUrl === null
}
```

Existing rows cannot be mistaken for pay later, because the derivation tests for `null` specifically.
An earlier draft of this spec claimed no persisted row could carry a falsy proof, reasoning that a failed upload always deletes the purchase.
The conclusion held but the reasoning did not: a failed upload does delete, but a failed proof-URL write did not, and that path could leave a row with an empty-string proof and money attached.
A direct count against the production table returned zero such rows, so none exist in practice.
Were one to appear, it would read as pay-now under `=== null`, the same answer it got before this feature, so nothing regresses.
The failure that created them is closed off in the purchase-creation section below.

A `PAY_LATER` value on the `PaymentType` enum was considered and rejected.
`PaymentType` maps one-to-one onto `PaymentStatus` through `paymentStatusFromType`, and it is admin-editable through `PaymentStatusForm`.
A third value breaks that mapping and surfaces a nonsensical option in that dropdown.

A pay-later purchase keeps `paymentType: PARTIAL`, which is what checkout already submits, so the resulting enrollment is `PARTIALLY_PAID`.

## Validation

`createPurchaseSchema` gains a `payLater` boolean.
`amountPaid` becomes conditional rather than unconditionally positive:

- Paying now: `amountPaid` must be positive and a whole number of centavos, exactly as today.
- Paying later: `amountPaid` must be absent or zero.

A `superRefine` rejects a submission that sets `payLater` and also carries a positive amount, so the client cannot send a self-contradicting purchase.

## Student checkout

A single checkbox sits above the amount and file inputs: "Pay later - enroll now, pay after approval".

Checking it hides the "Amount Paying Now" and "Proof of Payment" inputs rather than disabling them, since neither is answerable, and replaces them with a short explanation: enrollment starts once an admin approves, and the full course total will then show as the student's balance.
Hiding rather than disabling also removes the `required` inputs from the form, which is what lets submission proceed.

`PaymentInstructions` stays on screen either way, because the student still needs the account details to pay eventually.
Its line "Pay via bank transfer or GCash, then upload your proof of payment below" is untrue in the pay-later case, so the component takes a prop that swaps that sentence for one pointing at paying after approval.

The page heading copy on `page.tsx` ("Review your selection, then upload your proof of payment") becomes neutral wording that holds for both paths, because the page is a server component and does not know the checkbox state.

## Purchase creation

`createPurchaseAction` branches once, after course re-validation:

- Paying later: skip `validateImageUpload`, skip the Supabase upload, and skip the follow-up proof-URL update.
  Create the purchase with `amountPaid: 0` and `paymentProofUrl: null`.
- Paying now: unchanged.

The confirmation email and the redirect are otherwise untouched, but one error path changes, and it has to.

Today, if the proof image uploads but the follow-up write of its URL fails, the purchase is left behind with `paymentProofUrl` set to the empty string and the student's money attached.
Empty string is not null, so it reads as pay-now: the admin sees a broken image and investigates.
Once creation writes `null` instead, that same failure strands a row that reads as a genuine pay-later purchase, and the admin is told a paying student chose to pay later.
Approving it applies nothing and the payment is lost silently.

So that failure path now deletes the purchase, exactly as the upload-failure path beside it already does, and asks the student to submit again.
That is what makes "a null proof means pay later" true by construction rather than merely intended.
The cost is an orphaned image in storage, which the neighbouring path already accepts.

Do not restore the old behaviour of returning an error and leaving the row in place.
The `MISSING_PROOF` guard in the approval action is the backstop for the case where the compensating delete itself fails, since a database outage can take both writes down together.
`sendPurchaseConfirmationEmail` currently says "We have received your course purchase and proof of payment", which is wrong for pay later, so it takes a flag and uses a variant sentence.

## Admin review

The approval logic in `approvePurchaseAction` is unchanged in behaviour, with one type-safety guard added.
`Payment.proofUrl` stays non-null, so once `purchase.paymentProofUrl` is nullable the ledger write needs the null ruled out.
The branch that writes it already runs only when an applied amount is above zero, which can only happen when money arrived at checkout, which means a proof exists.
The guard therefore throws on a null proof at that point rather than writing an empty string, so an impossible state fails loudly instead of silently entering the ledger as a payment with no evidence.

It already requires the applied amounts across courses to sum to `amountPaid`, and for a pay-later purchase that reconciles as `0 = 0`.
It already skips writing a `Payment` ledger row when an applied amount rounds to zero, so an approved pay-later purchase correctly produces no ledger rows.
Enrollment creation, revival of a removed enrollment, `totalDue`, batch assignment, and the archived-course guard are all unaffected.

What changes is what the admin sees:

- The purchases queue and the detail page show a "Pay later" badge, so an admin is not hunting for a proof image that was never submitted.
- The detail page renders "No proof submitted - student chose to pay later" in place of `ProofImage`.
  The proof API route already returns 404 for a falsy `paymentProofUrl` and needs no change, but nothing should be asking it for one.
- The detail page's "Amount paid" line reads as zero, which is correct and needs no special casing.
- `ApproveForm` hides the per-course "Amount applied" inputs when `amountPaid` is zero, since every one of them must be zero for the reconcile check to pass, and submits zeros for them.
  Its intro text drops the "and how much of the X received applies to each" clause.
  The "Total due" inputs, the blank-means-untracked behaviour, and the prior-paid warning stay exactly as they are.

Rejection is unchanged.

## After approval

The student holds an enrollment with `paymentStatus: PARTIALLY_PAID`, a `totalDue` the admin set, and no payments against it.
The existing balance view therefore shows them owing the full total, and the existing `/student/payments/[enrollmentId]` flow is how they pay it down.
No new student-facing surface is needed.

There is no student-facing purchase history in the app today, so a pending pay-later purchase needs no new display beyond the existing post-checkout redirect.

## Testing

Unit tests, vitest, alongside the existing suites in `lib/__tests__/purchases`:

- Schema: a pay-later submission with no amount passes; one with a positive amount is rejected; a pay-now submission still requires a positive amount.
- `createPurchaseAction`: the pay-later path creates a purchase with `amountPaid: 0` and a null proof, and performs no upload.
- `approve-pay-later.test.ts`: approving a zero-amount purchase succeeds, creates the enrollment with the admin's `totalDue`, and writes no `Payment` rows.

Then a manual end-to-end pass: check the box at checkout, submit, approve as admin, and confirm the student is enrolled and sees the full total as their balance.

## Risks

Making `paymentProofUrl` nullable widens a column every proof-reading path depends on.
The proof route already guards against a falsy value; the admin detail page is the only other reader and is being changed here.
TypeScript will surface anything missed, since the generated Prisma type narrows from `string` to `string | null`.

An approved pay-later enrollment grants full course access to a student who has paid nothing.
That is the intended behaviour and the admin's approval is the deliberate gate on it.
