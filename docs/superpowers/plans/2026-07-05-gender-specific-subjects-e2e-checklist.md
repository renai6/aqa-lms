# Gender-Specific Subjects - Manual E2E Checklist

Run through these after deploying, since there is no automated browser harness.
Set up: one course with three subjects - **Mixed** (Everyone), **Brothers** (Male only), **Sisters** (Female only) - each with at least one lesson and one published assessment.
Have a male student and a female student enrolled in the course.

## Student visibility (hard boundary)

- [ ] Male student's course page lists **Mixed** and **Brothers**, not **Sisters**.
- [ ] Female student's course page lists **Mixed** and **Sisters**, not **Brothers**.
- [ ] Male student opening the Sisters subject by direct URL (`/student/courses/{id}/subjects/{sistersId}`) gets a 404 (not found).
- [ ] Male student opening a Sisters **assessment** by direct URL gets a 404.
- [ ] Male student cannot start or submit a Sisters assessment attempt via crafted request (server action returns "not available").
- [ ] Female student can open the Sisters subject, its lessons, and take/submit its assessment normally.

## Counts and progress

- [ ] Male student's dashboard progress %, subject/lesson counts, and schedule list reflect only Mixed + Brothers (Sisters excluded).
- [ ] Female student's equivalents reflect only Mixed + Sisters.
- [ ] "Recent results" never shows a result from a subject the student can no longer see.

## Null-gender student (legacy)

- [ ] A student with no gender set sees only **Mixed**; both Brothers and Sisters are hidden and 404 on direct access.

## Teacher views

- [ ] Teacher of the Sisters subject sees only female enrollees in the roster and gradebook.
- [ ] Teacher's "My Subjects" `studentCount` for Sisters matches the number of female enrollees, not all enrollees.
- [ ] Teacher of the Mixed subject still sees all enrollees.

## Public / pre-enrollment page

- [ ] Logged-out course page shows all three subjects.
- [ ] Brothers shows a "Brothers only" badge; Sisters shows "Sisters only"; Mixed shows no badge.
- [ ] Subject and lesson counts on the public page include all three subjects.

## Admin authoring

- [ ] Creating a subject with "Visible to = Male only" persists and shows a "Male only" badge in the admin subject list.
- [ ] Editing a subject's "Visible to" back to Everyone removes the restriction (students of both genders see it again).
- [ ] Changing a Mixed subject (that already has male attempts/grades) to Female only shows the amber warning naming the affected count, and does **not** save until "Confirm change" is clicked.
- [ ] After confirming, the switch applies; the previously-participating male students' attempts/grades still exist in the database (verify the teacher gradebook for the male, if switched the other way, or query directly) and are simply hidden from those students.
- [ ] Admins continue to see and manage all subjects regardless of gender.
