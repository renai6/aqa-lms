# Certificate Download — Design Spec

**Date:** 2026-07-18
**Scope:** Student portal — downloadable course-completion certificate

---

## Overview

Students who finish a course with a passing weighted average can download a certificate of completion from their dashboard.
The download is only available when the student is eligible; otherwise the entry point is shown in a disabled state with a clear reason.

This is the temporary version of the certificate.
It renders as a print-optimized HTML page styled to match the web app, and the student saves it as a PDF via the browser's print dialog.
No server-side PDF library is introduced now.
The eligibility engine and route are designed so a real server-generated PDF can be swapped in later without changing the user-facing flow.

---

## Eligibility Rule

A student is eligible to download a course certificate when **all** of these conditions hold:

1. **Fully paid** — the student's `Enrollment.paymentStatus` for the course is `FULLY_PAID`.
2. **All subjects graded** — every subject in the course has a `Grade` row (teacher-assigned `finalGrade`) for this student.
3. **Passing average** — the weighted course grade is `>= course.passingGrade` (default 75).

Weighted course grade is `Σ(subjectFinalGrade × subject.units) / Σ(subject.units)`.

A single subject with a weak grade can be carried by stronger subjects, as long as the weighted average passes.
If any subject is not yet graded, the certificate stays locked (the course is still considered in progress).

---

## Data Model

One additive constraint.
The existing `Certificate` model gains `@@unique([userId, courseId])` so auto-issue can be a single idempotent `upsert` (one certificate per student per course, safe under concurrent requests).
No columns change:

```prisma
model Certificate {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  courseId      String
  course        Course   @relation(fields: [courseId], references: [id])
  certificateNo String   @unique
  pdfUrl        String?
  issuedAt      DateTime @default(now())

  @@unique([userId, courseId])
}
```

`pdfUrl` stays null for the temporary version.

**Certificate number format:** `AQA-<YYYY>-<6 uppercase hex chars>` (for example `AQA-2026-3F9A1C`).
The 6 hex chars come from 3 random bytes.
Uniqueness of the number is backed by the `certificateNo @unique` column; there is no fragile sequential counter that could collide under serverless concurrency.
Because issuance upserts on `[userId, courseId]`, the number is created once and stays stable for the life of the certificate.

---

## Computation (`lib/grades/`, `lib/certificates/`)

### `lib/grades/compute.ts` — new pure function

```ts
export type WeightedCourseItem = { units: number; finalGrade: number }

// Weighted average of subject final grades by Subject.units.
// Returns null when there are no items.
export function weightedCourseGrade(items: WeightedCourseItem[]): number | null
```

Mirrors the existing `weightedSubjectGrade`.
Covered by unit tests alongside the existing `compute.test.ts`.

### `lib/certificates/` — new modules

Split into pure (unit-tested) and db-aware pieces, matching the existing `subjects/visibility.ts` (pure) vs `subjects/access.ts` (db) pattern.

**`eligibility.ts` (pure):**

```ts
export type SubjectGradeInput = { units: number; finalGrade: number | null }

export type CertificateEligibility = {
  eligible: boolean
  allGraded: boolean
  courseGrade: number | null
  passingGrade: number
  gradedCount: number
  totalSubjects: number
}

export function certificateEligibility(
  subjects: SubjectGradeInput[],
  passingGrade: number,
): CertificateEligibility
```

`allGraded = totalSubjects > 0 && gradedCount === totalSubjects`.
`courseGrade = weightedCourseGrade(...)` over the graded subjects.
`eligible = allGraded && courseGrade !== null && courseGrade >= passingGrade`.

**`number.ts` (pure):** `generateCertificateNo()` returns `AQA-<YYYY>-<6 hex>`.

**`queries.ts` (db):** `getCertificateEligibility(userId, courseId)` and `getStudentCertificates(userId)`.
Both load the course's subjects using the same `subjectGenderFilter(userGender)` used elsewhere, so a subject restricted to the other gender is never counted (otherwise it could never be graded and would permanently lock the certificate).
They map subjects + the student's `Grade.finalGrade` into `SubjectGradeInput[]` and delegate to `certificateEligibility`.

**`issue.ts` (db):** `issueCertificate(userId, courseId)` upserts on `[userId, courseId]` and returns `{ certificateNo, issuedAt }`.

The returned eligibility shape gives the dashboard everything it needs to render a precise locked reason without a second query.

---

## Routes

### `/student/certificate/[courseId]` — new (server component)

On load:

1. Require a session; otherwise redirect to `/login`.
2. Verify the session user has an `Enrollment` in `courseId`; otherwise redirect to `/student/dashboard`.
3. Recompute eligibility server-side via `getCertificateEligibility`.
   The client is never trusted.
   If not eligible, redirect to `/student/dashboard` (defense in depth in case the disabled button was bypassed).
4. **Auto-issue:** upsert-style logic — if no `Certificate` row exists for this user + course, create one and set its `certificateNo` from the new row id; otherwise reuse the existing row.
   Idempotent, so the number and issue date stay stable across visits.
5. Render the print-optimized certificate plus a **Print / Save as PDF** control.

The issuance write lives in `lib/certificates/` (for example `issueCertificate(userId, courseId)`), keeping the route thin.

---

## Certificate Layout

A4 landscape, styled to match the web app (zinc text, `primary` accent, existing font stack).

Contents:

- Academy name and logo.
- "Certificate of Completion".
- Student full name (`firstName lastName`, falling back to `displayName`).
- Course title.
- Weighted average (for example "Final Average: 88%").
- Certificate number.
- Issue date.

A small `@media print` rule hides the Print button and page chrome so the printed output is only the certificate.
The "Print / Save as PDF" button is a tiny client component calling `window.print()`; everything else stays a server component.

---

## Dashboard Entry Point

A new **Certificates** section on the student dashboard (`app/(student)/student/dashboard/page.tsx`), using the existing section styling: the `text-[10px] uppercase tracking-[0.2em]` header and white rounded cards.

One row per enrolled course:

- **Eligible** — an active **Download Certificate** button linking to `/student/certificate/[courseId]`.
- **Not eligible** — a disabled button plus a short reason that uses the course's actual `passingGrade`, for example "Available once all subjects are graded and your average is ≥ 75%" (the threshold is interpolated from `passingGrade`, not hardcoded).

Eligibility for the section is computed in the dashboard's data layer (`lib/student/queries.ts`) so the page stays a server component and does no client-side eligibility logic.

---

## Out of Scope (YAGNI)

Deliberately not built in this iteration:

- Server-side PDF generation (`pdfUrl` stays null).
- Certificate issuance email.
- Admin issue / revoke / re-issue UI.
- Cross-course GWA.
- Per-course certificate template customization.

All of these can be added later on top of the same eligibility engine and route without reworking the student-facing flow.

---

## Testing

- Unit tests for `weightedCourseGrade` (empty, single, weighted, all-equal cases) alongside `compute.test.ts`.
- Unit tests for `getCertificateEligibility` covering: not all subjects graded, average below passing, average at/above passing, zero subjects.
- Manual end-to-end check: a student with all subjects graded and a passing average sees an active download and can reach the certificate page; a student missing a grade or below passing sees the disabled state and is redirected if they hit the route directly.
