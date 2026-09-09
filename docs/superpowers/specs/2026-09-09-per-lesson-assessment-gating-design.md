# Per-Lesson Assessment Gating Design

Every `Assessment` in the system hangs off a `Subject`, and the student subject page renders them as one flat list at the foot of the sidebar, ordered by `createdAt`.
Lessons carry an `order` and nothing reads it for access: every lesson in a subject is open from the day the student enrols, and `LessonCompletion` records only a self-reported "Mark as done" click.

This design attaches an assessment to a single lesson and makes passing it the condition for opening the lessons that follow.
A student who has not passed Lesson A's assessment cannot open Lesson B.

The feature is small in concept and awkward in practice, because three things the existing code does are incompatible with a gate.
There are no retakes, so one failure would lock a student out permanently.
Essay questions score only when a teacher grades them, so a gate containing one would wait on staff.
And enabling gating on a running batch would throw every student back to lesson one, since none of them has an attempt on an assessment that did not exist yesterday.
Each is resolved below.

## Goals

- An admin attaches an assessment to a lesson, and that assessment gates every later lesson in the subject.
- A student who fails retakes freely until they pass, without staff involvement.
- Passing is instant: no gate ever waits on a human to grade it.
- Turning gating on cannot lock a currently enrolled student out of a lesson they had already reached.
- Existing subject-level quizzes and exams behave exactly as they do today, and no student's subject grade, course grade, GWA, or certificate eligibility changes.

## Non-goals

- No gating of `BatchRecording`.
Recordings are per-batch records of live class sessions with no lesson association in the schema, and many students attended those sessions in person.
Gating them would require inventing a recording-to-lesson mapping that does not exist.
- No gating between subjects or between courses.
The gate is ordered lessons within one subject.
- No lesson assessments in the gradebook.
See "Grade isolation".
- No use of `Assessment.maxAttempts`.
The column stays unread, as it is today.
Wiring it up would contradict unlimited retakes.
- No teacher authoring of gates.
Stated as "admin only for now"; see "Authorization".
- No time-based or scheduled release of lessons.
The only condition is passing.

## Data model

Three additive changes.
Every column is nullable or defaulted, so the migration is safe on live data and needs no backfill.

```prisma
model Assessment {
  // Non-null makes this a lesson gate: the student must pass it before the
  // lessons ordered after this one open. Null is a subject-level quiz or exam,
  // which behaves exactly as it always has.
  lessonId String?
  lesson   Lesson? @relation(fields: [lessonId], references: [id])

  @@unique([lessonId])
}

model Course {
  // Off by default. When on, lessons in this course lock behind the gating
  // assessments on the lessons before them. The toggle exists so an admin can
  // author every lesson quiz first and enable gating deliberately, instead of
  // a single publish silently locking a live batch out of lessons it had
  // already reached.
  sequentialLessons Boolean @default(false)
}

model Lesson {
  assessment Assessment?
}
```

`@@unique` on a nullable column is exactly the constraint wanted here.
Postgres treats NULLs as distinct, so any number of subject-level assessments coexist while a lesson can hold at most one gate.

No new table.
`LessonCompletion` already carries `@@unique([userId, lessonId])`, which is the shape the gate needs, so passing an assessment upserts that same row.
Progress percentage, the green check in the sidebar, and the gate then read one source of truth and cannot disagree.

Two fields deliberately not added.
There is no `isGating` boolean, because `lessonId != null` already means "this gates" and a second flag could contradict the first.
`Assessment.weight` is untouched; gates are excluded from grading by filtering on `lessonId`, not by zeroing a weight.

## The unlock rule

The rule lives in a new `lib/lessons/gating.ts` as a pure function over already-loaded data, so it is unit testable without a database.

A lesson `L` is **satisfied** for a student when any of the following holds.

- `L` has no published gating assessment.
A lesson without a gate never blocks anything.
- The student has a `LessonCompletion` row for `L`.
This clause is both the record of passing and the grandfather clause, because they are the same row.
- The student has any attempt on `L`'s assessment scoring at or above its `passingScore`.

A lesson `N` is **locked** when `Course.sequentialLessons` is on and some lesson in the same subject with a lower `order` is not satisfied.

The third clause is redundant in normal operation, since passing writes the completion row that clause two reads.
It is kept as a fallback so a student is not stuck if that write ever failed, and it is free: `getStudentSubject` already loads this student's attempts for the sidebar status badges.

Two consequences follow directly and are intended.
The first lesson of a subject is never locked, because nothing precedes it.
An admin may gate lesson 3 and lesson 7 only, and the lessons between them stay open, because the assessment is the gate rather than the lesson boundary.

Every failure mode resolves to **open**.
An unpublished gate, a gate with a null `passingScore`, a course with the toggle off, and a subject with no gates all lock nothing.
A bug in this feature should never leave a paying student unable to study.

## Enforcement

Four enforcement points and one place deliberately left open.
The first is the one that matters.

`getStudentSubject` computes `isLocked` per lesson and, for a locked lesson, returns null for `materialUrl`, `videoUrl`, `audioUrl`, and `pptUrl`, and omits the lesson's assessment from the payload.
Hiding a row in React while server-rendering the Drive links into the same response would make the feature theatre, since anyone could read them from view-source.
The lock is a server-side content decision, and the UI merely reflects it.

`getStudentAssessmentLaunch` and `startAttemptAction` refuse a lesson assessment whose lesson is locked, closing the direct URL.

`markLessonDoneAction` rejects a locked lesson, and rejects any lesson that has a published gating assessment.
Where a gate exists, passing it is the only way to become done.

`unmarkLessonDoneAction` rejects a lesson that has a gating assessment.
Without this a student could un-tick a lesson and re-lock themselves out of everything after it.

`getStudentAttempt` is deliberately left open for a student's own attempts.
That is work they already did, and blocking it would break the review screen for no gain in access control.

Gender restriction, course archival, and enrollment checks all run before any gate logic, so the gate can only ever narrow access, never widen it.

## Retakes

`startAttemptAction` currently reads `if (existing) redirect(...)`, which is the one-attempt rule.
It becomes four cases.

- An `IN_PROGRESS` attempt resumes, as today.
- For a subject-level assessment, a completed attempt redirects to review, as today.
- For a lesson assessment the student has already passed, redirect to the passing attempt's review.
- For a lesson assessment the student has failed, create a fresh attempt.

Unlimited retakes are scoped to lesson assessments on purpose.
Loosening subject-level assessments would silently change how every existing exam in the system works, which is out of scope and a regression risk.
A test asserts that a failed subject-level attempt still refuses a second attempt.

### Writing the pass

`submitAttemptAction` scores the attempt as it does now.
If the assessment has a `lessonId` and the resulting score meets `passingScore`, it upserts the `LessonCompletion` inside the same transaction as the answer writes, then revalidates the subject, course, and dashboard paths.
The upsert is idempotent, so the existing concurrent-submit guard needs no change.

### Choosing which attempt counts

`pickRelevantAttempt` prefers any completed attempt over an in-progress one, which is correct for one-shot assessments and wrong once retakes exist: a student who failed and then passed would see the failure.
A new `pickBestAttempt` (highest score, most recent on a tie) is used for lesson assessments only.
`pickRelevantAttempt` is left untouched so the gradebook and exam surfaces keep their exact current behavior.

## Authorization

`createAssessmentAction` and `editAssessmentAction` in `lib/assessments/actions.ts` are shared by the admin and teacher route groups and authorize through `canManageSubject`, which returns true for an admin and for the subject's assigned teacher.
That sharing is why "admin only" is real work rather than a UI change.

`lib/auth/capabilities.ts` gains `isAdmin(session)`, true for `SUPER_ADMIN` and `ADMIN`.
Both actions keep `canManageSubject` for everything they do today, and additionally require `isAdmin` when the submitted `lessonId` is non-null **or** when the assessment being edited already has one.
The second half is the easy one to miss: without it a teacher could edit the questions or passing score of a live gate.

Teachers see gates read-only.
The subject assessment list shows them with their gate label, and the edit, publish, and delete controls are hidden in the UI and rejected on the server.
The teacher's existing subject-level assessment workflow is unchanged.

## Admin surface

Both assessment forms gain one optional "Gates lesson" field, listing the subject's lessons in `order`, with already-gated lessons disabled and labelled.
Leaving it unset produces today's subject-level assessment.
The field renders only for admins, so a teacher never sees a control they cannot use.

Publishing rules for a gate go into `getPublishBlockers` in `lib/assessments/publish-validation.ts`, which is already the single place publishing is validated, so an admin sees them in the existing blockers list rather than as a surprise error on submit.
A lesson-linked assessment cannot publish unless it has a `passingScore` and contains no `ESSAY` questions.
The question form blocks selecting ESSAY when the assessment has a `lessonId`, so the publish rule is a backstop rather than the primary defence.
Attaching a lesson to an assessment that already contains an essay is rejected at that moment, with a message naming the offending questions.

The course form gains a "Sequential lessons" checkbox.
Turning it **on** for a course with an active batch first shows a confirmation naming how many enrolled students would move from unlocked to locked.
This is the rollout failure mode made visible before it happens, rather than discovered through support messages.

The subject's assessment list gains a "Gates" column, and the lesson list gains the reciprocal indicator, so an admin can see at a glance which assessments are load-bearing.
Deleting a lesson that holds a gate, and deleting a gate that has attempts, both remain blocked by the existing has-attempts guard.

## Student surface

A locked lesson keeps its place in the sidebar so the student can see the shape of the subject.
The numbered circle becomes a lock icon, the title greys to `text-muted-foreground`, and neither the row nor the chevron toggles.
The row carries `aria-disabled` and an accessible label naming the remedy, for example "Locked. Pass the Lesson 3 quiz to unlock."

A lesson's gate renders as a row inside that lesson's expanded dropdown, alongside Download Material and Watch Lesson Video, rather than in the flat block at the foot of the sidebar.
That block survives and now holds only subject-level quizzes and exams.
The gate row carries primary emphasis within the dropdown, because it is the thing that moves the student forward rather than one more material link.

Status on the gate row, driven by `pickBestAttempt`: "Start Quiz" when never attempted, "Resume" when in progress, the score plus "Retake" when failed, and the score in the existing emerald pill when passed.
A passed gate also turns the lesson's circle into the familiar green check.
A failed gate is never a dead end.

The result screen closes the loop.
Passing shows the score and "Lesson 4 unlocked" with a link straight to it.
Failing shows the score against the threshold with a "Try again" button.
Without this the student submits, receives a number, and has to deduce whether anything happened.

For a gated lesson the "Mark as done" button is not rendered, matching the server-side rejection.
Ungated lessons keep it exactly as today.

### Failed-attempt review

On a **failed** lesson gate, the review screen shows which questions were wrong without revealing the correct answers.
Passed gates and all subject-level assessments keep today's full review.

This mitigates the obvious cost of unlimited retakes: fixed question order plus an answer-revealing review lets a student fail, read the answers, and retake to pass by memorization.
The mitigation is partial, not airtight, and it is chosen because it is one screen's worth of change.
Question shuffling and question banks are the real answer and are out of scope.

## Grade isolation

Lesson assessments are checkpoints, not graded work.
Ten of them at the default `weight` of 1.0 would drown out a subject's exam and silently change every student's subject grade, course grade, GWA, and certificate eligibility.

They are excluded by filtering `lessonId: null` in three places.

- The subject assessment aggregation in `getStudentCourse`, which feeds `averageScore` and the graded-assessment count.
- `getSubjectGradebook` in `lib/teacher/queries.ts`, which runs the same `weightedSubjectGrade` computation for the teacher's final-grade suggestion.
- `getStudentRecentResults`, so the dashboard's recent results stay about graded work rather than being flooded by checkpoints.

Scores remain fully visible on the lesson's own gate row, so a student still sees how they did.

A test asserts that `getStudentCourse` returns an identical `averageScore` with and without a lesson assessment present.
That is the guard against silently reshuffling everyone's grades.

## Edge cases

An admin publishing a gate mid-batch changes nothing until `sequentialLessons` is on.
When it is turned on, students holding a completion on the gated lesson stay unlocked, and the rest are counted in the confirmation dialog first.

Unpublishing a gate unlocks everything after it immediately.
This is the deliberate escape hatch for a quiz that turns out to be broken or wrongly worded.

Raising `passingScore` after students have passed leaves their completions standing.
No admin edit ever locks a student backwards.

Reordering lessons recomputes the gate set from `order`, so a lesson can move behind a gate it was not behind before.
Completions mitigate this for students who had already reached it.
The lesson reorder UI notes the effect rather than blocking the reorder.

A gate on the last lesson of a subject gates nothing, but passing it still marks the lesson done and feeds progress percentage.

`sequentialLessons` on with no gates authored locks nothing.

A lesson can hold a gate while having no `BatchLessonContent` for the student's batch.
The gate still applies; content availability and gating are independent.

## Testing

The project runs Vitest against a mocked `@/lib/db`.
`lib/__tests__/subjects/enforcement.test.ts` is the pattern for access-rule tests.

`lib/__tests__/lessons/gating.test.ts` covers the pure rule: the first lesson is never locked, an ungated lesson never blocks, a grandfathered completion satisfies, a passing attempt satisfies, the toggle off unlocks everything, and an unpublished gate or a null `passingScore` locks nothing.

Enforcement tests assert on the payload rather than the UI, because the payload is where a leak would actually occur.
`getStudentSubject` returns null media URLs for a locked lesson.
`startAttemptAction` refuses a locked lesson's assessment.
`markLessonDoneAction` and `unmarkLessonDoneAction` reject a gated lesson.

Retake tests assert that a new attempt is created after a failed lesson attempt, and is **not** created after a failed subject-level attempt.
The second assertion is the regression guard for the exam flow.

`submitAttemptAction` writes a `LessonCompletion` on a passing lesson attempt and not on a failing one.

Publish validation rejects an essay question and a missing `passingScore` on a gate.

Authorization tests assert a teacher is rejected when `lessonId` is set, on both create and edit of an existing gate.

Grade isolation is covered as described above.

An end-to-end pass in the running app completes the verification: an admin authors a gate and enables the toggle, a student sees lesson 2 locked, fails, retakes, passes, watches lesson 2 open, and sees the progress bar move.

## Migration

One migration adding `Assessment.lessonId` with its unique index, `Course.sequentialLessons` defaulting to false, and the `Lesson` back-relation.
No data backfill: gating is off for every existing course until an admin turns it on, and no assessment has a `lessonId` until an admin sets one.
The migration is therefore reversible in practice, since dropping the columns returns the system to its current behavior.
