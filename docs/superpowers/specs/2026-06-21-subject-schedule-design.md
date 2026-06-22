# Subject Schedule Design

**Date:** 2026-06-21  
**Status:** Approved

## Overview

Add per-subject scheduling to the LMS: admins define time slots (day of week + time range) for each subject; students see those slots read-only on their subject view.

Teacher assignment is already implemented via `SubjectTeacher` and `TeacherAssignmentPanel` — no changes needed there.

## Schema

Two additions to `prisma/schema.prisma`:

```prisma
enum DayOfWeek {
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
  SATURDAY
  SUNDAY
}

model SubjectSchedule {
  id        String    @id @default(cuid())
  subjectId String
  subject   Subject   @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  day       DayOfWeek
  startTime String    // "HH:MM" 24-hour
  endTime   String    // "HH:MM" 24-hour

  @@index([subjectId])
}
```

`Subject` gains a `schedules SubjectSchedule[]` relation. Times are stored as `"HH:MM"` 24-hour strings — no timezone complexity. `onDelete: Cascade` ensures slots are removed when the subject is deleted.

Duplicate days are allowed (e.g., two slots on Thursday for split sessions).

## API / Server Actions

Located in `app/(admin)/admin/courses/[id]/subjects/[sid]/actions.ts` alongside existing subject actions.

**`addScheduleAction(formData)`**
- Input: `subjectId`, `day` (DayOfWeek enum value), `startTime` ("HH:MM"), `endTime` ("HH:MM")
- Zod 4 validation: `day` must be a valid enum value; times must match `HH:MM` format; `startTime` must be before `endTime`
- Creates a `SubjectSchedule` row
- Calls `revalidatePath` on the subject detail page

**`removeScheduleAction(formData)`**
- Input: `scheduleId`, `subjectId`
- Deletes the `SubjectSchedule` row
- Calls `revalidatePath` on the subject detail page

`getSubjectById` in `lib/courses/queries.ts` is updated to `include: { schedules: { orderBy: { day: 'asc' } } }` so the subject detail page has schedule data on load with no extra fetch.

## Admin UI

A new `SchedulePanel` component at:
`app/(admin)/admin/courses/[id]/subjects/[sid]/schedule-panel.tsx`

Follows the same card pattern as `TeacherAssignmentPanel`. Placed in the right sidebar of the subject detail page, below `TeacherAssignmentPanel`.

**Structure:**
- Current slots list: each row shows "Thursday 7:00 PM – 9:00 PM" with a Remove button
- Add form: `Select` for day (all 7 days), two `<input type="time">` for start/end, "Add Slot" button
- Times stored as `"HH:MM"` (24-hour) in DB; displayed as 12-hour AM/PM in the UI
- Empty state: "No schedule set."

## Student-Facing UI

Schedule displayed read-only wherever subjects are shown to students. Slots sorted by canonical day order (Mon → Sun) and displayed as "Thursday 7:00 PM – 9:00 PM". No interaction.

Since the student dashboard is minimal now, the schedule is surfaced on subject cards/detail once those pages are built. The `getSubjectById` query already includes schedules — no extra fetch needed.

## Files Changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `DayOfWeek` enum, `SubjectSchedule` model, `schedules` relation on `Subject` |
| `lib/courses/queries.ts` | Include `schedules` in `getSubjectById` |
| `app/(admin)/admin/courses/[id]/subjects/[sid]/actions.ts` | Add `addScheduleAction`, `removeScheduleAction` |
| `app/(admin)/admin/courses/[id]/subjects/[sid]/schedule-panel.tsx` | New component |
| `app/(admin)/admin/courses/[id]/subjects/[sid]/page.tsx` | Add `SchedulePanel` to sidebar |

Migration: `pnpm prisma migrate dev --name add-subject-schedule`
