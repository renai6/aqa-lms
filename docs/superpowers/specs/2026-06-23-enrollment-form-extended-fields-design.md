# Enrollment Form Extended Fields

**Date:** 2026-06-23
**Status:** Approved

## Overview

Add 6 new required fields to the public enrollment form and persist them on `EnrollmentRequest`. A new business rule enforces that New Students must pay in full. The admin detail page is updated to display the new fields.

## Schema Changes

Add a new `StudentType` enum and 6 fields to `EnrollmentRequest`. The `Gender` enum (`MALE`/`FEMALE`) already exists.

```prisma
enum StudentType {
  NEW
  OLD
}

model EnrollmentRequest {
  // ...existing fields...
  gender        Gender
  address       String
  contactNumber String
  facebookName  String
  facebookLink  String
  studentType   StudentType @default(NEW)
}
```

One new migration required (`prisma migrate dev`). Fields are stored only on `EnrollmentRequest` — they are not copied to `User` on approval.

## Form UI

The form is reorganized into two labeled sections.

**Personal Information**
- First Name, Last Name (existing)
- Email (existing)
- Gender — radio toggle cards (Male / Female), same visual style as payment type cards
- Address — textarea (multi-line)
- Contact Number — text input, placeholder `09XXXXXXXXX`
- Facebook Name — text input
- Facebook Link — url input

**Payment**
- Student Type — radio toggle cards (New Student / Old Student), default: New Student
- Payment Type — Full / Partial cards. When New Student is selected, Partial card is hidden and `paymentType` is forced to `FULL` via a hidden input.
- Amount Paying Now (existing)

The course info strip stays at the top. Submit button stays at the bottom.

## Validation (Server Action)

Additional Zod rules added to the schema in `lib/enrollments/actions.ts`:

```ts
gender: z.enum(['MALE', 'FEMALE']),
address: z.string().min(1, 'Address is required.'),
contactNumber: z.string().regex(
  /^(09\d{9}|\+639\d{9})$/,
  'Enter a valid PH mobile number (e.g. 09XXXXXXXXX).'
),
facebookName: z.string().min(1, 'Facebook name is required.'),
facebookLink: z.string().url('Enter a valid URL.'),
studentType: z.enum(['NEW', 'OLD']),
```

Cross-field refinement: if `studentType === 'NEW'` and `paymentType !== 'FULL'`, return a validation error. This is a server-side guard in addition to the client-side UI hiding.

The `db.enrollmentRequest.create` call is updated to persist all 6 new fields.

## Admin Detail Page

The Applicant Information card in `app/(admin)/admin/enrollments/[id]/page.tsx` gains 6 new rows after the existing fields:

| Label | Value |
|---|---|
| Gender | Male / Female |
| Address | full address string |
| Contact Number | display as-is |
| Facebook Name | display name |
| Facebook Link | clickable anchor, opens in new tab |
| Student Type | New Student / Old Student |

The `getEnrollmentRequestById` query in `lib/enrollments/queries.ts` must select the new fields.

No changes to the approve/reject/payment flow.

## Files Affected

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `StudentType` enum; add 6 fields to `EnrollmentRequest` |
| `lib/enrollments/actions.ts` | Extend Zod schema + cross-field refinement; update `db.create` call |
| `lib/enrollments/queries.ts` | Select new fields in `getEnrollmentRequestById` |
| `app/(public)/courses/[id]/enroll/enroll-form.tsx` | Add fields, sections, dynamic New/Old student logic |
| `app/(admin)/admin/enrollments/[id]/page.tsx` | Display new fields in Applicant Information card |
