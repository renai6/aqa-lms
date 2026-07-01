# Batch System Design

**Date:** 2026-07-01
**Status:** Approved

## Overview

Add a batch system to the LMS so that students enrolled in a course are grouped into numbered batches.
Each batch shares the same lesson structure but has its own `materialUrl` and `recordingUrl` per lesson.
Batches are per-course, auto-numbered starting at 34 (continuing from pre-system batches), and have no time bounds - they are purely a grouping label.

## Schema Changes

### New model - `Batch`

```prisma
model Batch {
  id       String  @id @default(cuid())
  courseId String
  course   Course  @relation(fields: [courseId], references: [id])
  number   Int     // auto-incremented per course; first batch in system = 34
  isActive Boolean @default(false) // only one true per course at a time

  createdAt DateTime @default(now())

  enrollments   Enrollment[]
  lessonContent BatchLessonContent[]

  @@unique([courseId, number])
  @@index([courseId])
}
```

### New model - `BatchLessonContent`

```prisma
model BatchLessonContent {
  id       String @id @default(cuid())
  batchId  String
  batch    Batch  @relation(fields: [batchId], references: [id], onDelete: Cascade)
  lessonId String
  lesson   Lesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  materialUrl  String?
  recordingUrl String?

  @@unique([batchId, lessonId])
}
```

### Modified model - `Enrollment`

Add a nullable batch reference:

```prisma
batchId String?
batch   Batch?  @relation(fields: [batchId], references: [id])
```

### Modified model - `Lesson`

Remove `materialUrl` and `recordingUrl` fields.
These are migrated to `BatchLessonContent`.

### Modified model - `Course`

Add `batches Batch[]` relation.

## Data Migration

Runs once as a script after the schema migration is applied.

1. For each course that has at least one enrollment - create a `Batch` with `number: 34` and `isActive: true`.
2. For each lesson (traversing course → subjects → lessons) in those courses - if `materialUrl` or `recordingUrl` was set, create a `BatchLessonContent` record pointing to Batch 34 with those values.
3. For every existing `Enrollment` - set `batchId` to Batch 34 of their course.
4. Courses with no enrollments get no Batch 34; admin starts the first batch manually.

The `number` sequence going forward is per-course: `MAX(number) + 1` when a new batch is started.

## Business Logic

### Starting a new batch

`POST /api/admin/courses/[id]/batches`

- Find `MAX(number)` for the course and increment by 1.
- Create new `Batch` with `isActive: true`.
- Set all other batches for this course to `isActive: false` in the same transaction.
- No `BatchLessonContent` records are pre-created - admin adds them as sessions happen.

### Auto-assigning batch on enrollment

Inside the existing purchase approval flow, when an `Enrollment` is created:

- Find the course's active batch and set `batchId`.
- If no active batch exists, `batchId` stays null.
- Surface a warning on the course admin page if a course has no active batch (to prevent unassigned enrollments).

### Updating batch lesson content

`PUT /api/admin/batches/[bid]/lessons/[lid]`

- Upsert `BatchLessonContent` for the given batch + lesson.
- Only `materialUrl` and `recordingUrl` are writable.

### Reading lesson content as a student

Server-side in the lesson player page:

- Find the student's `Enrollment` for the course to get their `batchId`.
- Load `BatchLessonContent` for that batch + lesson.
- If no content record exists yet, show no URL - no fallback.

## Admin UI

### Course detail page (`/admin/courses/[id]`)

- Add a "Current Batch" badge showing the active batch number (e.g., "Batch 34").
- Add a "Start New Batch" button that creates the next batch and deactivates the current one.
- Show a warning if the course has no active batch.
- Confirmation dialog: "New enrollments will go to Batch N. Existing students stay in Batch N-1."

### Batch list page (`/admin/courses/[id]/batches`)

- Table of all batches: batch number, student count, active/inactive status.
- Clicking a batch row navigates to the batch management page.

### Batch management page (`/admin/courses/[id]/batches/[bid]`)

- Shows batch number and student count.
- Lists all lessons grouped by subject, with editable `materialUrl` and `recordingUrl` fields per lesson.
- Inline save per lesson (no full page reload).

## Student-Facing Changes

The lesson player (`/student/courses/[id]/subjects/[sid]`) currently reads `lesson.materialUrl` and `lesson.recordingUrl` directly.
After this change it loads `BatchLessonContent` for the student's batch.
Batch assignment is invisible to the student - they see their content as normal.

## Key Constraints

- Only one batch can be `isActive: true` per course at a time - enforced in the "start new batch" transaction.
- Students never change batches once enrolled.
- The batch number sequence is per-course and monotonically increasing.
- Batches have no start/end dates - they are grouping labels only.
