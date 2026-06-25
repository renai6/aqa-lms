# Purchase-Based Enrollment Flow — Design

**Date:** 2026-06-25
**Status:** Approved (design); pending implementation plan

## Summary

Replace the current pre-account enrollment flow with a register-then-purchase flow.

**Today:** A visitor fills an enrollment form (profile + payment) which creates an
`EnrollmentRequest` with **no account**, uploads payment proof, and an admin
approves/rejects. On approval a `User` + `Enrollment` are created and a temp password
is emailed.

**New:**
1. A visitor **registers** an account with their **own password** and full profile
   (no payment, no proof). Account is active immediately — **no email verification**,
   **no temp-password email**.
2. The student logs in. The student nav has a **Courses** link.
3. The student browses courses, selects **one or more** (a cart), and is taken to a
   checkout page to choose payment type, enter amount paid, and upload **one combined
   proof** for the whole cart.
4. This creates a **`Purchase`** (status `PENDING`). The student cannot access the
   purchased courses yet.
5. An **admin approves or rejects** the purchase. On approval, one `Enrollment` is
   created per course in the purchase, granting access.

## Decisions (locked)

- **Profile fields** (gender, address, contact number, Facebook name/link, student
  type) are collected **at registration**, stored on `User`.
- **Cart model:** student selects multiple courses, submits **one combined proof**.
  Selection is **client-side** (no persistent DB cart) and submitted in one shot.
- **Payment:** keep partial/full + amount, tracked at the **order (Purchase) level**.
  The existing "NEW students must pay in full" rule applies, keyed off
  `User.studentType`.
- **Email verification:** none. Accounts are active on registration.
- **Admin purchase actions:** **approve and reject** (reject requires a reason; the
  student is notified and may re-submit a new purchase).
- **Migration:** dev data is disposable. A plain destructive `prisma migrate dev`
  that drops removed tables/columns is acceptable.

## Architecture: `Purchase` + `PurchaseItem` (chosen Approach A)

A `Purchase` row is the payment record (status, payment type, amount, one proof,
admin remarks). `PurchaseItem` rows link it to the chosen courses. On approval the
system creates one `Enrollment` per item. Because student access is still determined
by "does an `Enrollment` exist for (userId, courseId)?", the entire student-side
access path (`getStudentCourse`, `getStudentSubject`, dashboard) is left unchanged.

Rejected alternatives:
- **Status on `Enrollment`:** a combined-proof cart maps to N enrollments, leaving the
  single proof/amount with no natural home, and every access query would need a
  `status: APPROVED` guard. More edits, more risk.
- **Repurpose `EnrollmentRequest`:** it is single-course and full of pre-account
  fields (email/name/profile) that now live on `User`. Fighting the old shape costs
  more than a clean model.

## Data model

### New models

```prisma
model Purchase {
  id              String           @id @default(cuid())
  userId          String
  user            User             @relation(fields: [userId], references: [id])
  status          EnrollmentStatus @default(PENDING)   // reuse PENDING/APPROVED/REJECTED
  paymentType     PaymentType      @default(FULL)
  amountPaid      Decimal          @default(0)
  paymentProofUrl String
  adminRemarks    String?                              // rejection reason
  reviewedById    String?
  reviewedBy      User?            @relation("ReviewedPurchases", fields: [reviewedById], references: [id])
  reviewedAt      DateTime?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  items           PurchaseItem[]
}

model PurchaseItem {
  id         String   @id @default(cuid())
  purchaseId String
  purchase   Purchase @relation(fields: [purchaseId], references: [id], onDelete: Cascade)
  courseId   String
  course     Course   @relation(fields: [courseId], references: [id])
  @@unique([purchaseId, courseId])
}
```

### Changed models

- **`User`** gains profile fields (nullable so admins/teachers are not forced to have
  them): `address String?`, `contactNumber String?`, `facebookName String?`,
  `facebookLink String?`, `studentType StudentType?`. `gender` already exists.
  Add relations: `purchases Purchase[]` and `reviewedPurchases Purchase[] @relation("ReviewedPurchases")`.
- **`Enrollment`** gains `purchaseId String?` + `purchase Purchase?` relation, linking
  each approved enrollment to the purchase that created it. `paymentStatus` is kept as
  a per-course display flag set on approval from `purchase.paymentType`
  (`FULL` → `FULLY_PAID`, `PARTIAL` → `PARTIALLY_PAID`).
- **`Course`** gains `purchaseItems PurchaseItem[]`; loses `requests EnrollmentRequest[]`.

### Removed

- The entire **`EnrollmentRequest`** model and its relations on `User`
  (`enrollmentRequests`) and `Course` (`requests`).
- The **`PaymentProof`** model and **`Enrollment.totalPaid`** — they do not fit a
  combined cart proof. Amount and proof now live on `Purchase`. The dashboard reads
  the linked `Purchase` for amount/proof/status.

## Flows

### Registration (new)

- Public route `/register` under `(auth)` + `registerAction`.
- Fields: email, password, confirm password, firstName, lastName, gender, address,
  contactNumber, facebookName, facebookLink, studentType.
- Zod schema reuses the existing field rules from the old enroll form (PH mobile regex
  `^(09\d{9}|\+639\d{9})$`, https Facebook link, etc.) plus password strength + match.
- Creates `User` with `role: STUDENT`, `isActive: true`, `mustChangePassword: false`,
  hashed password. Rejects duplicate email.
- On success: create session, redirect to `/student/courses` (or the dashboard).
- Login page links to `/register`.

### Browse + cart + checkout (new, student-side)

- Student nav gains **Courses** → `/student/courses`, listing published courses the
  student is not already enrolled in and has no `PENDING`/`APPROVED` purchase for.
- Cart selection is client-side page state; selecting one or more courses proceeds to
  a checkout page.
- Checkout page shows selected courses + total tuition, lets the student choose
  `paymentType` (with "NEW students must pay in full" enforced from `User.studentType`),
  enter `amountPaid`, and upload one proof image.
- `createPurchaseAction`: validates input; uploads the proof to Supabase reusing the
  magic-byte content validation from the old `uploadProofAction`; creates `Purchase`
  (`PENDING`) + `PurchaseItem`s in a transaction. Guards against an existing
  enrollment, or an existing `PENDING`/`APPROVED` purchase, for any selected course.

### Purchase status (new, student-side)

- `/student/purchases` lists the student's purchases: courses, amount, status, and
  rejection remarks when `REJECTED`, with a path to start a new purchase for rejected
  items.

### Admin approval (replaces enrollment approval)

- `/admin/enrollments` is repurposed/renamed to `/admin/purchases`, listing purchases
  (default filter `PENDING`).
- Detail page shows buyer, selected courses, amount, payment type, proof image, and
  Approve / Reject actions.
- `approvePurchaseAction` (transaction): guard `status === PENDING`; for each item
  create an `Enrollment` (`purchaseId`, `paymentStatus` derived from `paymentType`),
  skipping any course the user is already enrolled in; set purchase `APPROVED` +
  `reviewedById`/`reviewedAt`; email the student. Revalidate the list.
- `rejectPurchaseAction`: reason required; set `REJECTED` + `adminRemarks` +
  reviewer fields; email the student. Mirrors current reject logic and its
  email-failure handling (DB commit is not rolled back on email failure).
- Admin dashboard "pending enrollment requests" stat → "pending purchases."

## Removals (code)

- Public `/courses/[id]/enroll` (+ `enroll-form.tsx`), `/enroll/[requestId]`
  (+ `upload-proof-form.tsx`), and `submitEnrollmentAction` / `uploadProofAction` in
  `lib/enrollments/actions.ts`.
- Old enrollment `approveEnrollmentAction` / `rejectEnrollmentAction` /
  `updatePaymentStatusAction` + `approve-form`, `reject-form`, `payment-section`,
  `update-payment-status-form`, and the request `[id]` detail page — replaced by the
  purchase equivalents.
- `EnrollmentRequest`-related queries (`lib/enrollments/queries.ts`) rewritten for
  `Purchase`. Emails (confirmation/approval/rejection) rewritten for purchases with no
  credentials in their bodies.
- Payment-proof API routes (`app/api/admin/payment-proof/...`,
  `app/api/student/payment-proof/...`, `app/api/admin/enrollments/[id]/proof`)
  repointed to serve `Purchase.paymentProofUrl`.
- Public homepage / course CTAs change from "Enroll" to "Log in / Register to
  purchase."

## Migration

Destructive `prisma migrate dev`: add `Purchase`/`PurchaseItem`, add the new `User`
and `Enrollment` columns, drop `EnrollmentRequest`, drop `PaymentProof`, drop
`Enrollment.totalPaid`. Then `prisma generate`. No data backfill (dev data disposable).
Import enums/types from `@prisma/client` (no custom output path).

## Out of scope

- Persistent server-side shopping cart.
- Online/automated payment gateway (proof upload remains manual).
- Per-course split of a combined payment amount (amount is order-level only).
- Ongoing partial-payment top-ups against an existing enrollment (the old
  `PaymentProof` top-up flow is removed; a new payment is a new `Purchase`).
