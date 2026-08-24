# Additional Payments Design

Students who paid partially at checkout have no way to submit a further payment.
Today the only record of money received is `Purchase.amountPaid`, written once at checkout, and an admin flips `Enrollment.paymentStatus` by hand when the student settles up offline.
This design adds a student-initiated flow for submitting an additional payment (another partial, or the remaining balance) with proof of payment, and an admin queue for reviewing those submissions.

## Goals

- A student with a `PARTIALLY_PAID` enrollment can upload an amount plus a proof image against that enrollment.
- An admin reviews each submission in a dedicated queue and approves or rejects it.
- Approving records the payment and sets the enrollment's payment status, which the admin chooses explicitly.
- Every payment is retained as its own row, so the payment history for a student is recoverable.

## Non-goals

- No automatic balance math.
The system does not sum payments against tuition fees or decide when a student is fully paid.
The admin decides, as they do today.
- No backfill of existing purchases into the new table.
`Purchase.amountPaid` remains the record of the initial payment.
- No change to the checkout or purchase approval flows.
- No online payment gateway.
Payment still happens offline via bank transfer or GCash, and the student uploads proof.

## Data model

One new model in `prisma/schema.prisma`:

```prisma
model Payment {
  id           String           @id @default(cuid())
  enrollmentId String
  enrollment   Enrollment       @relation(fields: [enrollmentId], references: [id])
  amount       Decimal
  proofUrl     String
  status       EnrollmentStatus @default(PENDING)
  adminRemarks String?
  reviewedById String?
  reviewedBy   User?            @relation("ReviewedPayments", fields: [reviewedById], references: [id])
  reviewedAt   DateTime?
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  @@index([enrollmentId])
  @@index([status])
}
```

Two back-relations are added:

- `Enrollment.payments Payment[]`
- `User.reviewedPayments Payment[] @relation("ReviewedPayments")`

Design notes:

- `status` reuses the existing `EnrollmentStatus` enum (`PENDING`, `APPROVED`, `REJECTED`), exactly as `Purchase.status` does.
The name is a slight misnomer there already, but introducing a near-identical second enum would be worse than the inconsistency.
- `Payment` carries no `paymentStatus` field.
The resulting `PARTIALLY_PAID` or `FULLY_PAID` value lives where it already lives, on `Enrollment`.
A `Payment` row records only the amount, the proof, and its review state.
- Total paid for an enrollment is therefore `Purchase.amountPaid` plus the sum of that enrollment's approved `Payment` amounts.
This two-source sum is a deliberate trade: backfilling historical purchases into `Payment` carries real migration risk against the shared production database, with no user-facing benefit today.

### Migration

The schema change requires a migration that this session cannot run.
Per the project's Prisma workflow, the user runs `pnpm prisma migrate dev --name add_payment` in their own terminal, then the agent runs `pnpm prisma generate` to refresh the client.
`migrate deploy` will not create the migration, and a drift or reset prompt means the branch is behind `origin/main`, never a real database problem.

## Storage

Proof images go to the same Supabase bucket used by purchases, under `payment/{paymentId}/proof.{ext}`.

Admins read them through a new route, `app/api/admin/payments/[id]/proof/route.ts`, which is a near-copy of `app/api/admin/purchases/[id]/proof/route.ts`:
it verifies the session cookie, requires `ADMIN` or `SUPER_ADMIN`, and returns a 300-second signed URL.

## Student flow

### Entry point

The student dashboard already renders a Payment section listing every `PARTIALLY_PAID` enrollment (`app/(student)/student/dashboard/page.tsx`).
Each row gains one of three states:

- No pending payment: an **Add payment** button linking to `/student/payments/[enrollmentId]`.
- A pending payment: the text "Payment under review", with no button, so the student cannot double-submit.
- A rejected last payment: the admin's stated reason, plus the button again.

### The page

`app/(student)/student/payments/[enrollmentId]/page.tsx` is a server component.
It loads the enrollment and redirects to the dashboard unless all of the following hold:

- The enrollment belongs to the session user.
- Its `paymentStatus` is `PARTIALLY_PAID`.
- Its course is not archived.
- It has no `PENDING` payment.

It renders the course title, the payment instructions, and the form.

### The form

The form asks for two things only, mirroring checkout:

- Amount paid now, a positive number.
- Proof of payment, an image validated by the existing `validateImageUpload` (JPG, PNG, or WEBP, 10MB maximum, magic-byte checked).

### Shared payment instructions

The BPI and GCash instruction block is currently hard-coded inside `app/(student)/student/checkout/checkout-form.tsx`.
This flow needs the identical block, so it moves to `components/payment-instructions.tsx` and both forms use it.
Without this, the account numbers live in two places and drift the first time they change.

### The action

`createPaymentAction` in `lib/payments/actions.ts` follows `createPurchaseAction` step for step:

1. Require a `STUDENT` session and an active account.
2. Parse and validate the input with `createPaymentSchema` in `lib/payments/schema.ts`.
3. Re-check the guards server-side, since the page's checks are advisory only.
4. Validate the uploaded image.
5. Create the `Payment` row with an empty `proofUrl`.
6. Upload the image to `payment/{id}/proof.{ext}`.
7. Write the storage path back to `proofUrl`.
8. Send a confirmation email.
9. Redirect to `/student/dashboard?payment=1`, which shows a success banner.

## Admin flow

### Queue

`/admin/payments` lists payments with Pending, Approved, and Rejected tabs and per-tab counts, a direct parallel of `/admin/purchases`.
It is backed by `getAdminPaymentsByStatus` and `getPaymentStatusCounts` in `lib/payments/queries.ts`.
Each row shows the student name, the course title, the amount, and the submission date, and links to the detail page.

A sidebar link is added in `app/(admin)/layout.tsx`, next to the existing Purchases link.

### Detail and review

`/admin/payments/[id]` shows the student, the course, the amount, and the proof image.

**Approve** is where the admin's decision is captured.
The approve form carries a required choice of resulting enrollment status, Partially paid or Fully paid.
`approvePaymentAction` runs both writes in a single transaction:

- The payment becomes `APPROVED`, with `reviewedById` and `reviewedAt` set.
- The enrollment's `paymentStatus` becomes the chosen value.

It then emails the student.

**Reject** requires a reason, mirrors `rejectPurchaseAction`, stores the reason in `adminRemarks`, and emails it to the student.

### Shared proof image component

`ProofImage` in `app/(admin)/admin/purchases/[id]/proof-image.tsx` hard-codes the purchases API path.
It is generalized to take a `src` prop and moved to `components/admin/proof-image.tsx`, so both detail pages share one component.

## Error handling

The failure paths copy those already proven in `createPurchaseAction` and `approvePurchaseAction`:

| Failure | Behavior |
| --- | --- |
| Supabase upload fails | Delete the just-created `Payment` row and return "Failed to upload payment proof." No orphan rows are left behind. |
| Writing `proofUrl` fails | The row exists without a proof; return the "contact support" message, as purchases do. |
| Email fails | Logged and non-fatal. The payment still stands. |
| Two admins approve at once | `updateMany({ where: { id, status: 'PENDING' } })` and a `count === 0` result returns "This payment has already been processed." |
| Student deactivated | The `isActive` check in the action rejects the submission. |

## Edge cases

- **Two tabs, two submissions.**
The "no pending payment" guard is a read-then-write, so a determined double-submit can create two pending rows.
Postgres cannot express this as a plain unique constraint, since it is unique only where `status = PENDING`.
The blast radius is small: the admin sees two rows and rejects one.
This race is accepted rather than solved with a partial index.
- **Archived course.**
If the enrollment's course is archived, the button is hidden and the action refuses.
Collecting money for a course hidden from every surface is the wrong outcome.
- **Already fully paid.**
Guarded at both the page and the action, so a stale tab cannot submit.
- **Rejected payments keep their proof file.**
There is no storage cleanup, matching how rejected purchases behave today.

## Testing

The suite is vitest with `@/lib/db` mocked, and there is no test database, so these are unit tests in that style:

- `lib/__tests__/payments/schema.test.ts`: the amount must be a positive number, and the proof is required.
- `lib/__tests__/payments/guards.test.ts`: the guard is extracted as a pure `canAddPayment(enrollment, payments)` returning an ok or a reason, so the page and the action share one tested rule instead of duplicating three conditions.
- `lib/__tests__/payments/approve.test.ts`: approval sets both the payment status and the enrollment status inside one transaction; a second approval returns "already processed"; rejection requires a reason.
Modeled on `lib/__tests__/purchases/approve-archived-course.test.ts`.

Mocked tests cannot prove the new column exists.
After the migration is applied, verify the real client compiles with `./node_modules/.bin/tsc --noEmit`.

There is no E2E harness in the repo; Playwright is a dependency but there is no config or spec directory.
The real flow is verified by running the app and driving it in a browser: submit as a student, approve as an admin, and confirm the dashboard reflects the new status.
