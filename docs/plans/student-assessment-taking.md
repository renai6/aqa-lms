# Student Assessment Taking & Results

Vertical slice that closes the loop from admin-published assessments to student-visible results.
Admins can already create, edit, and publish assessments with questions.
This slice lets students discover published assessments, take them under server-enforced timing, get auto-scored, and see their results on both the subject page and their dashboard.

## Scope

In scope (D1):

- Discover published assessments on the student subject page.
- Take an assessment through a two-phase, server-timed attempt.
- Auto-score objective questions (MULTIPLE_CHOICE, TRUE_FALSE) on submit.
- A full per-question review page for a completed attempt.
- A "Recent Results" section on the student dashboard.

Out of scope (deferred to later slices):

- Teacher/admin essay grading (essays are captured but left "Awaiting grading").
- The `Grade` table and subject-grade rollup.
- Course grade, GWA, and certificate issuance.
- `Enrollment.progress` recomputation from assessments.
- Honoring `Assessment.maxAttempts` beyond a single completed attempt.

## Success criteria

- A student sees every published assessment for a subject they are enrolled in, with its current status (Take / Score / Awaiting grading).
- Starting an assessment creates a server-timed attempt; submitting auto-scores objective questions and records the attempt.
- The student can review a completed attempt question by question, including correct answers for objective questions.
- The dashboard reflects the student's most recent completed attempts across all enrolled courses.

## Architecture

New code lives beside the existing patterns.
Student-facing assessment queries extend `lib/student/queries.ts`.
A new `lib/assessments/scoring.ts` holds pure auto-scoring logic (unit-tested like `lib/assessments/publish-validation.ts`).
A new server-actions file holds `startAttemptAction` and `submitAttemptAction`.
New routes sit under the existing student subject tree.

### Routing

```
/student/courses/[id]/subjects/[sid]
    -> subject page: lessons sidebar + NEW "Assessments" group (D6)

/student/courses/[id]/subjects/[sid]/assessments/[aid]
    -> launch page: title, type, duration, passing score, question count,
       [Start] (or resume) / result summary if already completed

/student/courses/[id]/subjects/[sid]/assessments/[aid]/attempt/[attemptId]
    -> take page (IN_PROGRESS): questions form + display-only countdown
    -> review page (SUBMITTED/GRADED): per-question breakdown (D5)
       (same route renders review when the attempt is no longer IN_PROGRESS)
```

### Attempt lifecycle (D2, D4, D9)

Start (`startAttemptAction`):

1. Verify session, STUDENT role, and enrollment in the course that owns the assessment.
2. Verify `assessment.isPublished` (D8).
3. If an `IN_PROGRESS` attempt exists for this `(user, assessment)`, resume it (redirect to its attempt page).
4. Else if a `SUBMITTED`/`GRADED` attempt exists, block starting and route to the result (one completed attempt total).
5. Else create an `AssessmentAttempt` with `status = IN_PROGRESS` and server-set `startedAt`, then redirect to the take page.

Take page:

- Renders questions with a display-only client countdown derived from `startedAt + durationMins`.
- Answers are held in client state only; nothing is written until submit (D9).
- Resuming after a tab-close reopens a blank form; the timer continues from the server `startedAt`.

Submit (`submitAttemptAction`):

1. Verify session, ownership of the attempt, and that the attempt is still `IN_PROGRESS`.
2. Verify `assessment.isPublished`; if unpublished, the attempt cannot be submitted (orphaned, D8).
3. Auto-accept regardless of elapsed time (never reject a timed submission, per `PROJECT_SPEC.md:227`).
4. Persist a `StudentAnswer` row per question from the submitted form.
5. Auto-score objective answers via `lib/assessments/scoring.ts`.
6. Apply essay/status rules (D3, below).
7. Redirect to the review page.

### Scoring (D3)

`lib/assessments/scoring.ts` (pure, unit-tested):

- MULTIPLE_CHOICE / TRUE_FALSE: `isCorrect` = submitted value matches the option flagged `isCorrect`; `pointsEarned` = `points` if correct else `0`.
- ESSAY: `isCorrect = null`, `pointsEarned = null` (awaiting grading).

Attempt finalization:

- If the assessment contains any ESSAY question:
  `attempt.score = null`, `attempt.status = SUBMITTED`.
  Results UI shows "Awaiting grading".
- Else (all objective):
  `attempt.score = totalPointsEarned / totalPoints * 100`, `attempt.status = GRADED`.

Score is a percentage `0-100` (Float), matching `PROJECT_SPEC.md:104`.
Pass/fail on the review page compares `attempt.score` to `assessment.passingScore` (only when both are non-null).

### Display

Subject page (D6):
Append an "Assessments" group beneath the lessons list in the existing left sidebar of `lesson-player.tsx` (or a sibling section on the subject page).
Each row shows title, a type badge, and status: `Take` / `Score NN%` / `Awaiting grading`.
Clicking a row navigates to the assessment launch page.
The full-height two-panel layout is preserved.

Review page (D5):
Overall score and pass/fail header (or "Awaiting grading"), then each question showing the student's answer, the correct answer for objective questions, and points earned.
Essays show the submitted text plus "Awaiting grading".
Revisiting a completed attempt renders the same page.

Dashboard (D7):
A new "Recent Results" section listing the student's most recent completed attempts across all enrolled courses.
Each entry: assessment title, course/subject, score % (or "Awaiting grading"), pass/fail, and a link to the review page.

### Access control and visibility (D8)

Every student-facing assessment read filters `assessment.isPublished = true`, including the subject page, the launch page, the dashboard Recent Results query, and the review page.
Unpublishing therefore hides the assessment and all its results from the student, and blocks submission of an in-progress attempt.
The take/review/launch pages additionally verify enrollment in the owning course and, for attempt pages, that the attempt belongs to the current user.

## Data model

No schema changes.
The existing `AssessmentAttempt`, `StudentAnswer`, `AttemptStatus`, and `QuestionOption.isCorrect` fields cover this slice.

## Testing strategy

- Unit-test `lib/assessments/scoring.ts` for MCQ/TF correctness, mixed essay handling, all-objective vs any-essay finalization, and the percentage formula, following the `publish-validation.test.ts` pattern.
- E2E happy path (per user's global bug/feature practice): student sees a published assessment, starts it, submits, lands on the review page with the expected score, and sees the result on the dashboard.

## Decision log

### D1: Slice scope stops at per-assessment results
- **Decision**: Take + auto-score + per-assessment results only. No `Grade` rollup, subject/course grade, GWA, or certificates. Essays are captured but not graded.
- **Rationale**: Focused, safely shippable vertical slice; the full academic engine (`PROJECT_SPEC.md:97-107`) is deferred to later slices.
- **Source**: user answer.

### D2: Two-phase, server-timed attempt
- **Decision**: Start creates an `IN_PROGRESS` attempt with server-set `startedAt` and opens a take page; submit auto-accepts and auto-scores. Duration enforced server-side; over-limit still accepted. Client timer is display-only.
- **Rationale**: Matches the schema (`AttemptStatus`, `startedAt`) and `PROJECT_SPEC.md:227`; retrofitting timing later is costly.
- **Depends on**: D1.
- **Source**: user answer.

### D3: Essays captured, no final score; objective auto-scored
- **Decision**: Auto-score MCQ/TF on submit. If any essay question exists, essay answers get `pointsEarned = null`, `attempt.score = null`, `status = SUBMITTED` ("Awaiting grading"). If all objective, `score = earned/total*100`, `status = GRADED`.
- **Rationale**: Matches schema semantics (`StudentAnswer.pointsEarned` nullable, `SUBMITTED` vs `GRADED`); a provisional number would mislead before grading.
- **Depends on**: D1, D2.
- **Source**: user answer.

### D4: One completed attempt; resume in-progress
- **Decision**: One completed attempt per assessment; `maxAttempts` config ignored this slice. An `IN_PROGRESS` attempt resumes on re-click; only `SUBMITTED`/`GRADED` attempts block re-taking and show the result.
- **Rationale**: User chose "one attempt only, no resume"; that dead-ended a tab-close under D2 (unfinished attempt would block forever with no result). Resolved by resuming the in-progress attempt while keeping one completed attempt total.
- **Depends on**: D2.
- **Source**: user answer, plus conflict resolution against D2.

### D5: Full per-question review page
- **Decision**: Dedicated results page shows overall score, pass/fail vs `passingScore`, and per-question breakdown revealing correct answers for MCQ/TF; essays show submitted text + "Awaiting grading". Revisiting a completed attempt renders the same page.
- **Rationale**: Best for learning; answer-key exposure is low-risk given one completed attempt.
- **Depends on**: D3, D4.
- **Source**: user answer.

### D6: Assessments in the subject-page sidebar
- **Decision**: Render published assessments as an "Assessments" group beneath the lessons list in the existing subject-page sidebar; clicking navigates to a launch page then the take page.
- **Rationale**: Minimal change to the full-height two-panel layout; unified table of contents; matches the existing sidebar pattern. `getStudentSubject` already returns the assessments array (`lib/student/queries.ts:274`), currently unused.
- **Depends on**: D1.
- **Source**: chosen by implementer at user's delegation.

### D7: Dashboard "Recent Results" section only
- **Decision**: One new dashboard section listing recent completed attempts across enrolled courses (title, course/subject, score % or "Awaiting grading", pass/fail, link to review). Discovery stays on the subject page.
- **Rationale**: Directly answers "results on the dashboard" without the extra query/UI of a to-do section; discovery already covered by D6.
- **Depends on**: D5.
- **Source**: user answer.

### D8: Unpublish hides everything from students
- **Decision**: All student-facing assessment reads filter `isPublished = true`, including dashboard results and the review page. Unpublishing hides the assessment and its results everywhere and blocks submission of an in-progress attempt (orphaned).
- **Rationale**: User chose "hidden means hidden" over persisting historical results; simpler, consistent filter across every student query.
- **Depends on**: D5, D7.
- **Source**: user answer.

### D9: Persist answers only on final submit
- **Decision**: Answers live in client state during the attempt; `StudentAnswer` rows are written once, at submit, then auto-scored. Resuming an `IN_PROGRESS` attempt reopens a blank form with the server timer still running.
- **Rationale**: Simplest single write path; robustness of autosave not worth the extra upsert logic for this slice.
- **Depends on**: D2, D4.
- **Source**: user answer.

## Open questions

None deliberately deferred within the slice.
The larger academic engine (subject/course grade, GWA, certificates, `Enrollment.progress`) and teacher essay grading are explicitly out of scope (D1) and will need their own design pass.
