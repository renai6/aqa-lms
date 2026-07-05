# Gender-Specific Subjects

## Goal

Let admins restrict a subject to a single gender.
A male-only subject is visible only to male students; a female-only subject only to female students.
Subjects with no restriction stay visible to everyone (the current behavior).
The restriction is a hard boundary: a student of the wrong gender cannot see the subject in any list _and_ cannot open it, its lessons, or its assessments by direct URL or API.

This works within the existing model where students enroll in a **course** and a course contains **subjects**.
Gender segregation happens at the subject level inside a shared course, so one course can hold both mixed subjects and gender-restricted subjects.

## Data model

Add a nullable gender column to `Subject`, reusing the existing `Gender` enum (`MALE` / `FEMALE`):

```prisma
model Subject {
  // ...existing fields...
  gender Gender? // null = visible to everyone; MALE/FEMALE = restricted
}
```

Semantics:

- `gender = null` -> mixed subject, visible to all (default; every existing subject).
- `gender = MALE` -> visible only to users with `gender = MALE`.
- `gender = FEMALE` -> visible only to users with `gender = FEMALE`.

`User.gender` is already `Gender?` and is required at registration (`registerSchema`, `lib/purchases/schema.ts`).
Users with `gender = null` are legacy/edge rows (there is no admin create-student path; students self-register).

### Visibility predicate

Introduce one shared, pure helper so every surface agrees on the rule.
Suggested location: `lib/subjects/visibility.ts`.

```ts
// Can a user of `userGender` see a subject of `subjectGender`?
export function canSeeSubject(
  userGender: Gender | null,
  subjectGender: Gender | null,
): boolean {
  if (subjectGender == null) return true; // mixed subject: everyone
  return userGender === subjectGender; // restricted: exact match only
}
```

Fail-closed: a `null`-gender user sees only mixed subjects and is blocked from every gendered subject.

Prisma filter form (for list queries), given the viewer's gender `g`:

```ts
// g may be null
const genderFilter =
  g == null ? { gender: null } : { OR: [{ gender: null }, { gender: g }] };
```

## Enforcement (hard boundary)

Enforcement lives at the query/action layer, not just in the UI.
Every place that loads a subject for a student applies either the list filter or the `canSeeSubject` check.

Student-facing read surfaces (all in `lib/student/queries.ts` unless noted):

- `getStudentCourse` — filter the `subjects` relation by `genderFilter`. Progress %, lesson totals, `averageScore`, and schedules then derive only from visible subjects.
- `getStudentDashboard` — same filter on the `course.subjects` selection, so dashboard progress counts and the schedule list only reflect visible subjects.
- `getStudentSubject` — after loading, return `null` (page shows `notFound()`) when `canSeeSubject(user.gender, subject.gender)` is false.
- `getStudentAssessmentLaunch` — load the assessment's `subject.gender`; return `null` on mismatch.
- `getStudentAttempt` — load `assessment.subject.gender`; return `null` on mismatch (blocks reviewing an attempt in a now-hidden subject).
- `getStudentRecentResults` — filter out results whose subject the user can no longer see.

Student-facing write surfaces:

- Assessment take/submit server actions under
  `app/(student)/student/courses/[id]/subjects/[sid]/assessments/actions.ts` and
  `.../assessments/[aid]/start-attempt-button` flow — re-check `canSeeSubject` before starting or submitting an attempt, refusing on mismatch.

All these queries already load the user's session (`getSession`) or `userId`; the user's `gender` must be included in the session or fetched alongside.
Confirm the session carries `gender`; if not, fetch it once per request.

## Null-gender users

A user with `gender = null`:

- Sees only mixed (`null`) subjects.
- Is hard-blocked from every `MALE`/`FEMALE` subject (same code path as a mismatched gender).

No profile-completion flow is added.
Legacy null rows are simply handled by the fail-closed rule.

## Admin authoring

- Add a "Visible to" `<select>` to the create and edit subject forms
  (`app/(admin)/admin/courses/[id]/subjects/new/create-subject-form.tsx`,
  `app/(admin)/admin/courses/[id]/subjects/[sid]/edit-subject-form.tsx`):
  options **Everyone** (`""` -> null), **Male only** (`MALE`), **Female only** (`FEMALE`).
- Extend `subjectSchema` in `app/(admin)/admin/courses/[id]/actions.ts` with
  `gender: z.enum(['MALE', 'FEMALE']).nullable()` (empty string coerced to null),
  and persist it in `createSubjectAction` / `updateSubjectAction`.
- Show a gender badge on the admin subject list.
- Admins always see all subjects regardless of gender (they manage them).

### Re-gendering a subject that already has data

Changing an existing subject's gender is allowed and never deletes data.
When the new restriction would exclude enrollees who already have attempts or grades in the subject, `updateSubjectAction` returns a warning the admin must confirm, e.g. "3 male students have attempts in this subject; they will lose access."
Orphaned attempts/grades stay in the database (invisible to those students and filtered out of the teacher gradebook); nothing is destroyed.

## Teacher & admin views

Teacher roster and gradebook must match "who can actually participate":

- `getSubjectStudents` (`lib/teacher/queries.ts`) — filter enrollees by the subject's gender.
- `getSubjectGradebook` — same filter on the enrollee list.
- `getTeacherSubjects` — the `studentCount` (currently a raw `enrollment.count` on the course) must count only matching-gender enrollees for gendered subjects.

Null-gender enrollees are excluded from gendered subjects (consistent with the fail-closed rule).
Admins continue to see everything.

## Public / pre-enrollment page

The public course page (`app/(public)/courses/[id]/page.tsx` via `getPublicCourseDetail`) is a brochure shown to logged-out visitors whose gender is unknown.

- Show **all** subjects, including restricted ones — do not filter `getPublicCourseDetail`.
- Add a gender badge on restricted subjects (e.g. "Brothers only" / "Sisters only").
- Subject and lesson counts stay complete (they include restricted subjects).

## Migration

- Prisma migration adds the nullable `Subject.gender` column. Additive and non-destructive; every existing subject becomes "Everyone" (`null`) with no backfill.
- Existing `null`-gender **users** are left untouched (cannot infer gender); the fail-closed rule covers them.
- The dev database is a shared remote Supabase (project memory). The migration is non-destructive, but get explicit user go-ahead before running it against that DB.

## Testing

- **Unit tests** for `canSeeSubject` covering the matrix: mixed subject + any gender (incl. null) -> visible; restricted subject + matching gender -> visible; restricted + mismatched gender -> blocked; restricted + null user -> blocked.
- **Unit tests** that the hardened queries (`getStudentSubject`, `getStudentAssessmentLaunch`, `getStudentAttempt`) return `null` on gender mismatch, matching the existing `lib/__tests__` style.
- **Manual E2E checklist** (written doc, since there is no browser-test harness):
  1. Male student cannot see a female-only subject in the course list or dashboard.
  2. Male student gets `notFound()` opening the female subject / its assessment by direct URL.
  3. Female student sees and can open it; mixed subjects visible to both.
  4. Progress %, subject/lesson counts, and schedule list reflect only visible subjects.
  5. Teacher roster/gradebook for a gendered subject list only matching-gender students; `studentCount` matches.
  6. Public course page shows all subjects with correct badges and complete counts.
  7. Re-gendering a subject with existing opposite-gender data triggers the admin warning and preserves the data.

---

## Decision log

### D1: Data model representation

- **Decision**: Add nullable `Subject.gender` (`Gender?`); `null` = everyone, `MALE`/`FEMALE` = restricted.
- **Rationale**: Reuses the existing `Gender` enum and mirrors `User.gender`; the default (everyone) needs no backfill; queries read naturally. Chosen over a new `SubjectAudience` enum.
- **Source**: user answer (deferred to recommendation) + codebase (`prisma/schema.prisma:89`, `:172`).

### D2: Enforcement strength

- **Decision**: Hard boundary. Filter lists _and_ block direct access in every student subject/assessment query and take/submit action, returning `notFound()`/`null` on mismatch.
- **Rationale**: The feature's purpose is segregation; current queries only gate on enrollment (`lib/student/queries.ts`), so soft filtering would leave a reachable hole.
- **Depends on**: D1.
- **Source**: user answer.

### D3: Null-gender users

- **Decision**: See only unrestricted subjects; hard-blocked from gendered ones (fail-closed). No profile-completion flow.
- **Rationale**: Never leak gendered content to an unknown gender; there is no admin create-student path, so null is a legacy edge case only.
- **Depends on**: D1, D2.
- **Source**: user answer (deferred) + codebase (no admin student-create form; `registerSchema` requires gender).

### D4: Public / pre-enrollment page

- **Decision**: Show all subjects to visitors with a gender badge on restricted ones; no filtering of `getPublicCourseDetail`; counts stay complete.
- **Rationale**: The public page is a brochure; hiding subjects understates the curriculum and corrupts counts. A badge is honest and informative.
- **Depends on**: D1.
- **Source**: user answer.

### D5: Teacher & admin views

- **Decision**: Filter teacher roster, gradebook, and `studentCount` by subject gender; admins see all.
- **Rationale**: Otherwise teachers see male rows in a female-only subject that can never have data; `getSubjectStudents`/`getSubjectGradebook` currently pull all course enrollees.
- **Depends on**: D1, D2.
- **Source**: user answer.

### D6: Re-gendering a subject with existing data

- **Decision**: Allow the change, never delete orphaned data, but warn the admin when excluded-gender enrollees already have attempts/grades.
- **Rationale**: Blocking is too rigid for an admin tool; silent orphaning risks surprise; data preservation is mandatory.
- **Depends on**: D1, D5.
- **Source**: user answer.

### D7: Progress & schedule math

- **Decision**: Progress %, lesson counts, `averageScore`, and dashboard schedules derive only from gender-visible subjects.
- **Rationale**: Forced by list filtering in D2 — the student queries already compute these over the (now filtered) subject set.
- **Depends on**: D2.
- **Source**: forced by D2.

### D8: Migration & backfill

- **Decision**: Additive nullable column, no subject backfill (all become "Everyone"); leave null-gender users as-is; get user consent before running against the shared remote Supabase dev DB.
- **Rationale**: Non-destructive default; gender cannot be inferred for legacy users; project memory flags the shared remote DB.
- **Depends on**: D1, D3.
- **Source**: forced by D1/D3 + project memory (shared remote Supabase).

### D9: Testing depth

- **Decision**: Unit tests on `canSeeSubject` and the hardened queries, plus a written manual E2E checklist. No new automated E2E harness.
- **Rationale**: Locks down the security-critical predicate and query behavior in the existing test style; there is no browser-test harness to extend.
- **Depends on**: D2.
- **Source**: user answer.

## Open questions

None. All branches resolved.
