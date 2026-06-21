# Enrollment Request Flow Design

**Date:** 2026-06-21
**Status:** Approved
**Scope:** Public-facing enrollment flow — course listing, enrollment form, confirmation page, proof-of-payment upload, and confirmation email. Admin review side is already built.

---

## Overview

Prospective students discover published courses at `/courses`, click "Enroll Now" on a course card, fill out a short form, and are redirected to a confirmation page where payment instructions and a proof-of-payment upload form are presented. A confirmation email is sent immediately with a link back to the confirmation page so the student can return to upload proof in a separate session.

---

## 1. Routing & Page Structure

All public pages live under `app/(public)/` with a shared layout wrapping the existing Navbar and Footer components.

| Route | File | Purpose |
|---|---|---|
| `/courses` | `app/(public)/courses/page.tsx` | Server component. Fetches published courses, renders a card grid. Each card links to `/courses/[id]/enroll`. |
| `/courses/[id]/enroll` | `app/(public)/courses/[id]/enroll/page.tsx` | Server component. Loads course (404 if not found or unpublished). Renders `EnrollForm`. |
| `/enroll/[requestId]` | `app/(public)/enroll/[requestId]/page.tsx` | Server component. Loads enrollment request (404 if not found). Shows applicant summary, payment instructions, and `UploadProofForm` (or success message if proof already uploaded). |

**Layout:** `app/(public)/layout.tsx` renders `<Navbar>` and `<Footer>` around `{children}`. The root `app/page.tsx` is unchanged — it renders Navbar/Footer directly.

---

## 2. Data Layer

### New queries in `lib/enrollments/queries.ts`

```ts
export type PublishedCourseRow = {
  id: string
  title: string
  description: string | null
}

export async function getPublishedCourses(): Promise<PublishedCourseRow[]>
// where: { isPublished: true }, orderBy: { title: 'asc' }

export async function getPublishedCourseById(id: string): Promise<PublishedCourseRow | null>
// where: { id, isPublished: true }
```

`EnrollmentRequestDetail` (already exists) is reused for the confirmation page — no changes needed.

### New server actions in `lib/enrollments/actions.ts`

**`submitEnrollmentAction(formData)`**
- Input: `firstName`, `lastName`, `email`, `courseId` (hidden)
- Zod 4 validation: all fields required; email must be valid format; courseId non-empty string
- Verify course exists and `isPublished: true` — return error if not
- Duplicate check: if an `EnrollmentRequest` with the same email + courseId has status `PENDING` or `APPROVED`, return `{ error: 'You have already applied for this course.' }`. A `REJECTED` request does not block re-application — the student may submit a new request.
- Create `EnrollmentRequest` with `status: PENDING`
- Send confirmation email via `sendEnrollmentConfirmationEmail` (separate try/catch — email failure does not prevent the request from being created)
- `redirect('/enroll/' + request.id)`
- Returns `{ error: string }` on validation/DB failure; never returns on success (redirect)

**`uploadProofAction(formData)`**
- Input: `requestId` (hidden), `file` (the uploaded image)
- Validate: file exists, MIME type is `image/jpeg` / `image/png` / `image/webp`, size ≤ 5MB (5 × 1024 × 1024 bytes)
- Fetch enrollment request — return error if not found or status is `APPROVED` / `REJECTED`
- Upload to Supabase Storage (private bucket) via existing `supabaseAdmin` client. Storage path: `proof/${requestId}/${file.name}`
- Update `EnrollmentRequest.paymentProofUrl` in DB with the storage path
- Returns `{ error: null, success: true }` or `{ error: string }`

---

## 3. UI Components

### `app/(public)/layout.tsx`
Wraps all public pages with `<Navbar>` and `<Footer>`. No auth gating.

### `app/(public)/courses/page.tsx`
Server component. Calls `getPublishedCourses()`. Renders a responsive card grid. Each card shows course title, description (truncated), and an "Enroll Now" link button → `/courses/[id]/enroll`. Empty state: "No courses available at this time."

### `app/(public)/courses/[id]/enroll/enroll-form.tsx` — `'use client'`
- `useActionState(submitEnrollmentAction, { error: null })`
- Displays course name as read-only context above the form: "Enrolling in: [Course Title]"
- Hidden `<input name="courseId" value={courseId} />`
- Fields: First Name, Last Name, Email — shadcn `Input` + `Label`
- Submit button: "Submit Application"
- Error message displayed below on failure

### `app/(public)/enroll/[requestId]/upload-proof-form.tsx` — `'use client'`
- `useActionState(uploadProofAction, { error: null })`
- Hidden `<input name="requestId" value={requestId} />`
- `<input type="file" name="file" accept="image/jpeg,image/png,image/webp" />`
- Submit button: "Upload Proof of Payment"
- On `state.success`: replaces form with static message: "Thank you — your proof of payment has been received. We will notify you by email once reviewed."
- Error message displayed on failure (wrong type, too large, already uploaded, etc.)

### `app/(public)/enroll/[requestId]/page.tsx`
Server component. Fetches enrollment request via `getEnrollmentRequestById`. Shows:
1. **Applicant summary** — name, email, course, submission date, status badge
2. **Payment Instructions card** — hardcoded GCash number and bank account details (BDO/BPI or whichever is configured at code level)
3. **Proof upload section** — renders `<UploadProofForm>` if `paymentProofUrl` is null; renders "Proof of payment already received." if already uploaded

---

## 4. Email

New function added to `lib/enrollments/email.ts`:

**`sendEnrollmentConfirmationEmail`**
- To: applicant's email
- Subject: `"We received your enrollment application — Al-Qur'an Academy"`
- Body:
  - Greeting with first name
  - Confirmation that application for [course name] was received
  - Link to `/enroll/[requestId]` — "Return to this page to upload your proof of payment"
  - Hardcoded payment instructions (GCash + bank) — same as on the page
  - "We will notify you by email once your payment has been verified."

Sent inside a separate try/catch in `submitEnrollmentAction` — email failure logs a warning but does not prevent the enrollment request from being created.

---

## 5. Files Changed / Created

| File | Action |
|---|---|
| `app/(public)/layout.tsx` | Create — Navbar + Footer public layout |
| `app/(public)/courses/page.tsx` | Create — published course listing |
| `app/(public)/courses/[id]/enroll/page.tsx` | Create — enrollment form page |
| `app/(public)/courses/[id]/enroll/enroll-form.tsx` | Create — client form component |
| `app/(public)/enroll/[requestId]/page.tsx` | Create — confirmation + payment instructions + upload |
| `app/(public)/enroll/[requestId]/upload-proof-form.tsx` | Create — client upload component |
| `lib/enrollments/actions.ts` | Create — `submitEnrollmentAction`, `uploadProofAction` |
| `lib/enrollments/queries.ts` | Modify — add `getPublishedCourses`, `getPublishedCourseById` |
| `lib/enrollments/email.ts` | Modify — add `sendEnrollmentConfirmationEmail` |

---

## 6. Out of Scope

- Course detail page (`/courses/[id]`) — enroll button links directly from the listing card
- Re-upload / replace proof (admin views existing proof via signed URL — no student-side replacement in this scope)
- Enrollment status polling / real-time updates (student is notified by email on approval/rejection — already built)
- Proof upload progress bar (files are ≤ 5MB; server action is sufficient)
- Admin-configurable payment details (hardcoded in UI code)
