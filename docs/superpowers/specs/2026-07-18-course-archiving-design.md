# Course Archiving Design

Date: 2026-07-18

## Problem

Deleting a course fails for any course that has enrollments, purchases, or certificates attached.

`deleteCourseAction` in `app/(admin)/admin/courses/actions.ts` deletes lessons, then subjects, then the course.
It never removes the rows in `Enrollment`, `PurchaseItem`, or `Certificate` that reference `Course`.
Those three relations use Prisma's default `onDelete: Restrict`, so Postgres rejects the delete.

Reproduced against the live database inside a rolled-back transaction:

```
code: P2003
originalCode: 23503
originalMessage: update or delete on table "Course" violates foreign key
                 constraint "PurchaseItem_courseId_fkey" on table "PurchaseItem"
```

The transaction rolls back and the `catch` block reports the generic message "A database error occurred. Please try again."
The admin is never told the real reason.

### The failure is not about draft versus published

The reported symptom was that only draft courses delete.
A scan of all 26 courses shows the real predicate is whether the course has attached records:

| Status | Deletes today | Blocked today |
| --- | --- | --- |
| Draft | 7 | 1 (`Marhala Mutawassitah 1 obs`) |
| Published | 12 | 5 |

Twelve published courses would delete fine, and one draft course is blocked.
The correlation the reporter observed was coincidental.

## Decision

Replace hard deletion with archiving.
Nothing is ever destroyed, and the operation cannot fail on a foreign key constraint.

The driving use case is cleaning up obsolete duplicate courses.
Several courses carry an `obs` suffix, and at least one of them has a real enrollment and purchase attached.

## Scope of hiding

An archived course is hidden from students completely.
Lessons, grades, progress, and certificates all disappear from the student's view.

Admin purchase history is the deliberate exception.
`getAdminPurchasesByStatus` and `getAdminPurchaseById` continue to show archived course titles.
Blanking those out would render past purchases as empty rows in the admin's own financial records.

## Schema

Add one nullable column to `Course` in `prisma/schema.prisma`:

```prisma
archivedAt DateTime?

@@index([archivedAt])
```

A nullable timestamp is preferred over a boolean.
The query cost is the same, and it records when the archiving happened.

This requires one migration.

## Actions

`deleteCourseAction` becomes `archiveCourseAction`.
The entire transaction that deletes lessons, subjects, and the course is replaced by a single update that sets `archivedAt` to the current time.
No foreign key is touched, so the operation cannot fail the way it does today.

A new `restoreCourseAction` sets `archivedAt` back to `null`.

Both actions keep the existing `ADMIN` and `SUPER_ADMIN` authorization check.

## Query filtering

Every course-facing read gains an `archivedAt: null` filter.

A single shared exported constant holds the filter rather than repeating an inline literal at each call site.
This keeps the rule greppable and gives one place to audit.

| Surface | Functions |
| --- | --- |
| Public catalog and detail | `getPublishedCourses`, `getPublicCourseGroup`, `getPublicCourseDetail`, `getPublishedCourseById` |
| Admin lists | `getCourses`, `getCourseOptions`, `getCourseById`, admin dashboard published count |
| Nested lookups | `getSubjectById`, `getLessonById`, filtered through the course relation |
| Student surfaces | all functions in `lib/student/queries.ts` |
| Purchase and checkout | `getPurchasableCourses`, `getCheckoutCourses` |
| Certificates | `getCertificateEligibility` |

## Server-side guards

Hiding a course from a listing is not sufficient.
The checkout and enrollment actions must reject archived courses explicitly.

Without this, a stale cart or a bookmarked URL can still purchase a hidden course.

## Admin UI

The destructive `DeleteCourseButton` becomes `ArchiveCourseButton`.
The confirmation copy states that the course will be hidden rather than permanently destroyed.

The `/admin/courses` list gains an Active and Archived filter.
The Archived view lists archived courses with their `archivedAt` date and a Restore action.

Restore is included so that an accidental archive is a one-click fix rather than a manual database edit.
Without it, the main advantage of archiving over deletion is lost.

## Testing

The key regression test is the original bug.
Archiving a course that has both enrollments and purchase items must succeed, which is exactly the case that fails today with `P2003`.

Additional coverage:

- Each surface in the filtering table excludes an archived course.
- Admin purchase history still shows the title of an archived course.
- Checkout and enrollment actions reject an archived course.
- Restore returns a course to every surface it was previously hidden from.

## Out of scope

Hard deletion is removed entirely.
There is no remaining code path that permanently destroys a course.

Existing course rows are unaffected by the migration, since `archivedAt` defaults to `null`.
