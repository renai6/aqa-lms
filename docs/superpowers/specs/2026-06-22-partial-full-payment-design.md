# Partial & Full Payment Enrollment — Design Spec

**Date:** 2026-06-22
**Status:** Approved

---

## Overview

Students enrolling in a course may pay in full or make a partial payment upfront. The admin reviews proof of payment and sets the official payment status. Partially paid students retain full course access; payment status is tracking-only. Students can submit additional payment proofs from their dashboard, which the admin reviews before updating the status.

---

## Schema Changes

### `Course` model — add `tuitionFee`

```prisma
tuitionFee  Decimal?
```

Nullable so existing courses without a set fee are not broken. Admins set this via the course edit form.

---

### `EnrollmentRequest` model — add payment intent fields

```prisma
paymentType  PaymentType  // student's declared intent: PARTIAL | FULL
amountPaid   Decimal      // amount being paid upfront
```

`paymentProofUrl` already exists and is unchanged.

---

### `Enrollment` model — add payment tracking

```prisma
paymentStatus  PaymentStatus  // PARTIALLY_PAID | FULLY_PAID
totalPaid      Decimal        @default(0)
paymentProofs  PaymentProof[]
```

---

### New `PaymentProof` model

Tracks every payment submission (initial at enrollment + subsequent from dashboard).

```prisma
model PaymentProof {
  id           String     @id @default(cuid())
  enrollmentId String
  enrollment   Enrollment @relation(fields: [enrollmentId], references: [id])
  proofUrl     String     // Supabase path: proof/{enrollmentId}/{timestamp}.{ext}
  amount       Decimal
  note         String?    // optional student message
  submittedAt  DateTime   @default(now())
}
```

---

### New enums

```prisma
enum PaymentType {
  PARTIAL
  FULL
}

enum PaymentStatus {
  PARTIALLY_PAID
  FULLY_PAID
}
```

---

## Feature Areas

### 1. Enrollment Form (Public)

**File:** `app/(public)/courses/[id]/enroll/enroll-form.tsx`

Add to the existing form:

- **Payment type** — radio toggle: "Partial Payment" / "Full Payment"
- **Amount paid** — number input (₱), required
- Course `tuitionFee` displayed as reference: "Total tuition: ₱X,XXX"

**Server action:** `lib/enrollments/actions.ts` → `submitEnrollmentAction`
- Add `paymentType` and `amountPaid` to the Zod schema and EnrollmentRequest creation

The proof upload step at `app/(public)/enroll/[requestId]/` is unchanged.

---

### 2. Admin Approval Flow

**File:** `app/(admin)/admin/enrollments/[id]/page.tsx` and `actions.ts`

On the EnrollmentRequest detail view (PENDING requests):

- Display student's declared **payment type** and **amount paid**
- The Approve form adds a **payment status selector**: "Partially Paid" / "Fully Paid" (defaults to match student's declared type)

**`approveEnrollmentAction` changes** — inside the existing transaction, after creating User and Enrollment:
1. Set `Enrollment.paymentStatus` to the admin's chosen status
2. Set `Enrollment.totalPaid` = `EnrollmentRequest.amountPaid`
3. Create the first `PaymentProof` record from `EnrollmentRequest.proofUrl` and `amountPaid`

---

### 3. Student Dashboard — Payment Section

**File:** `app/(student)/student/dashboard/page.tsx`

New "My Enrollment & Payments" section showing:

- Course name and enrollment date
- **Payment status badge** — "Partially Paid" / "Fully Paid"
- **Amount progress** — e.g., ₱5,000 / ₱10,000
- **Payment history table** — rows from `PaymentProof`: date, amount, note
- **"Submit Additional Payment" form** — shown only when `paymentStatus = PARTIALLY_PAID`:
  - Amount field (Decimal, required)
  - Note field (optional)
  - File upload: JPG/PNG/WEBP, max 5MB, magic-byte validated (matches existing course image pattern)
  - Stored in Supabase at `proof/{enrollmentId}/{timestamp}.{ext}`
  - Creates a new `PaymentProof`; does NOT auto-update `paymentStatus`

**New server action:** `app/(student)/student/dashboard/actions.ts` → `submitAdditionalPaymentAction`
- Validates student session
- Uploads proof to Supabase (same pattern as `uploadProofAction`)
- Creates `PaymentProof` record in a transaction; updates `Enrollment.totalPaid`

**New API route:** `app/api/student/payment-proof/[proofId]/route.ts`
- Student-only signed URL for viewing their own proof images (5-min TTL)

---

### 4. Admin — Payment Management for Enrolled Students

**File:** `app/(admin)/admin/enrollments/[id]/page.tsx`

For APPROVED requests, add a **"Payment"** section below the existing request info:

- Payment status badge
- Total paid vs tuition fee
- Payment history table — all `PaymentProof` records with date, amount, note, and a "View Proof" link (uses existing signed-URL pattern via `/api/admin/enrollments/[id]/proof`)
- **"Update Payment Status"** form — select PARTIALLY_PAID or FULLY_PAID, submit

**New server action:** `updatePaymentStatusAction` in `app/(admin)/admin/enrollments/[id]/actions.ts`
- Validates admin role
- Updates `Enrollment.paymentStatus`
- Sends notification email to student

**New API route:** `app/api/admin/payment-proof/[proofId]/route.ts`
- Admin-only signed URL for viewing additional PaymentProof images submitted from the student dashboard

---

### 5. Course Tuition Fee — Admin

**File:** `app/(admin)/admin/courses/[id]/page.tsx` (course edit form)

Add a **Tuition Fee** field (optional Decimal input) to the course edit form so admins can set the fee per course. Uses the existing `updateCourseAction`.

---

### 6. Email Notifications

**File:** `lib/enrollments/email.ts`

Two new emails sent via Resend when `updatePaymentStatusAction` runs:

**Payment recorded (→ PARTIALLY_PAID):**
> Subject: Payment Recorded — [Course Name]
> Your payment of ₱X has been recorded. Total paid: ₱Y of ₱Z. Please submit your remaining balance from your student dashboard.

**Fully paid (→ FULLY_PAID):**
> Subject: Full Payment Confirmed — [Course Name]
> Congratulations! Your full payment of ₱Z for [Course Name] has been confirmed.

---

## Data Flow Summary

```
Enrollment Form
  └─ paymentType + amountPaid + proof upload
        └─ EnrollmentRequest (PENDING)
              └─ Admin approves with paymentStatus choice
                    └─ Enrollment created (paymentStatus, totalPaid)
                    └─ PaymentProof #1 created (from EnrollmentRequest proof)
                    └─ Approval email sent

Student Dashboard (PARTIALLY_PAID only)
  └─ submitAdditionalPaymentAction
        └─ PaymentProof #N created
        └─ Enrollment.totalPaid updated

Admin reviews PaymentProof #N
  └─ updatePaymentStatusAction
        └─ Enrollment.paymentStatus updated
        └─ Notification email sent to student
```

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add tuitionFee, paymentType, amountPaid, paymentStatus, totalPaid, PaymentProof model, new enums |
| `lib/enrollments/actions.ts` | Update submitEnrollmentAction |
| `app/(public)/courses/[id]/enroll/enroll-form.tsx` | Add payment type + amount fields |
| `app/(admin)/admin/enrollments/[id]/actions.ts` | Update approveEnrollmentAction, add updatePaymentStatusAction |
| `app/(admin)/admin/enrollments/[id]/page.tsx` | Show payment info, payment history, update status form |
| `app/(admin)/admin/courses/[id]/page.tsx` | Add tuitionFee field to course edit form |
| `app/(student)/student/dashboard/page.tsx` | Add payment section |
| `app/(student)/student/dashboard/actions.ts` | New — submitAdditionalPaymentAction |
| `app/api/student/payment-proof/[proofId]/route.ts` | New — student signed URL for own proofs |
| `app/api/admin/payment-proof/[proofId]/route.ts` | New — admin signed URL for PaymentProof images |
| `lib/enrollments/email.ts` | Add payment recorded + fully paid emails |
| `lib/enrollments/queries.ts` | Add queries for PaymentProof, Enrollment with payment data |

---

## Verification

1. **Enrollment form** — Submit with Partial/Full toggle and amount; verify EnrollmentRequest has paymentType + amountPaid in DB
2. **Admin approval** — Approve with "Partially Paid" selected; verify Enrollment has paymentStatus=PARTIALLY_PAID, totalPaid matches, PaymentProof #1 exists
3. **Student dashboard** — Log in as student; verify payment badge, history table, and upload form (visible when PARTIALLY_PAID, hidden when FULLY_PAID)
4. **Additional proof upload** — Submit from dashboard; verify new PaymentProof in DB, totalPaid updated on Enrollment
5. **Admin payment update** — View enrolled student, update to FULLY_PAID; verify Enrollment updated, email received
6. **Email delivery** — Check Resend logs for payment recorded and fully paid emails
7. **Tuition fee** — Set fee on course; verify it displays on enrollment form and payment progress
