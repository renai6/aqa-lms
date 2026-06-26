# Course: Google Meet Link + Duration Design

**Date:** 2026-06-26
**Status:** Approved

## Summary

Add two optional fields to the `Course` model:

1. **`meetLink`** — a Google Meet URL for the course's recurring virtual classroom.
2. **`courseDuration`** — a `SHORT | LONG` enum that categorizes how long the course runs.

Both fields are optional and nullable so existing courses are unaffected.

---

## Schema Changes

Add a new enum and two fields to `prisma/schema.prisma`:

```prisma
enum CourseDuration {
  SHORT
  LONG
}

model Course {
  // existing fields...
  meetLink       String?
  courseDuration CourseDuration?
}
```

A `prisma migrate dev` migration is required after the schema change.

---

## Data Layer (`lib/courses/queries.ts`)

- Add `meetLink: string | null` and `courseDuration: CourseDuration | null` to `CourseDetail` and `PublishedCourseRow` types.
- Add both fields to the `select` clauses in `getCourseById`, `getCourses`, `getPublishedCourses`, and `getPublishedCourseById`.

---

## Server Actions (`app/(admin)/admin/courses/actions.ts`)

Extend `courseSchema` (Zod 4):

```ts
meetLink: z.string().url('Must be a valid URL.').optional().or(z.literal('')),
courseDuration: z.enum(['SHORT', 'LONG']).optional(),
```

- `meetLink`: optional; if non-empty must be a valid URL. Empty string is treated as `null`.
- `courseDuration`: optional enum; absent/unset saves as `null`.

Both `createCourseAction` and `updateCourseAction` are updated to read and persist these fields.

---

## Admin Forms

### Create form (`app/(admin)/admin/courses/new/create-course-form.tsx`)

- **Meet Link**: `<input type="url" name="meetLink">` — optional, with helper text "Only applicable for Online courses."
- **Duration**: radio group `name="courseDuration"` with values `SHORT` / `LONG` plus a "Not specified" default (no value). Follows the same pattern as the existing Course Type radios.

### Edit form (`app/(admin)/admin/courses/[id]/edit-course-form.tsx`)

Same additions as create form, pre-populated from `course.meetLink` and `course.courseDuration`.

---

## Public Course Cards (`app/(public)/courses/page.tsx`)

- **Duration badge**: shown next to the existing Online/On-Site badge in the top-left of the course card image. Uses a neutral color (e.g. `bg-zinc-600 text-white`). Only rendered when `courseDuration` is set.
- **Meet link**: rendered as a small "Join Meet" button/link below the course title, only when `meetLink` is set and the course is published. Opens in a new tab (`target="_blank" rel="noopener noreferrer"`).

---

## Files Affected

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `CourseDuration` enum + `meetLink`, `courseDuration` fields |
| `lib/courses/queries.ts` | Extend types and select clauses |
| `app/(admin)/admin/courses/actions.ts` | Extend Zod schema + action data |
| `app/(admin)/admin/courses/new/create-course-form.tsx` | Meet link input + duration radios |
| `app/(admin)/admin/courses/[id]/edit-course-form.tsx` | Same, pre-populated |
| `app/(public)/courses/page.tsx` | Duration badge + Meet link on course cards |

---

## Out of Scope

- Per-lesson or per-subject Meet links (can be added later via `recordingUrl`/`materialUrl` patterns).
- Filtering courses by duration on the public page (not requested).
- Validation that `meetLink` is specifically a `meet.google.com` URL (any valid URL is accepted).
