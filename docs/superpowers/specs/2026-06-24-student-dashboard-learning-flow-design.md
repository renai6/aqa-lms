# Student Dashboard & Learning Flow — Design Spec

**Date:** 2026-06-24
**Scope:** Student portal — dashboard redesign + course/subject learning flow

---

## Overview

The student portal currently has a single page showing payment information only. This spec covers the full student-facing learning flow: a redesigned dashboard, a course page, and a subject page with lessons and assessments.

---

## Data Model

### New model: `LessonCompletion`

```prisma
model LessonCompletion {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  lessonId    String
  lesson      Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  completedAt DateTime @default(now())

  @@unique([userId, lessonId])
  @@index([userId])
}
```

Add the back-relation to `User` and `Lesson` in the schema.

### Existing `Enrollment.progress`

The stored `progress` Float is kept but not written to. Progress is always computed on the fly from `LessonCompletion` counts. No migration needed beyond adding the new model.

---

## Routes

| Route | Description |
|---|---|
| `/student/dashboard` | Redesigned dashboard (existing route) |
| `/student/courses/[id]` | Course page — subjects list + overall progress |
| `/student/courses/[id]/subjects/[sid]` | Subject page — Lessons tab + Assessments tab |

---

## Student Layout (`app/(student)/layout.tsx`)

Replace the empty pass-through layout with a shell containing:

- **Top navigation bar:**
  - Left: Academy logo/name linking to `/student/dashboard`
  - Right: student's display name + Sign Out button
- **Auth guard:** redirect to `/login` if no session — individual pages do not need to repeat this check
- **Main content area** below the nav bar

No sidebar. Breadcrumbs within pages handle orientation.

---

## Dashboard Page (`/student/dashboard`)

### Sections (top to bottom)

**1. Welcome header**
- "Welcome back, [firstName]"
- No global payment badge — payment status is per-enrollment and shown on each course card and in the payment summary section below

**2. Upcoming Schedules strip**
- Compact horizontal list of schedule chips
- Each chip: `[Subject name] · [Day] [Start]–[End]`
- Source: `SubjectSchedule` across all subjects in all enrolled courses
- Sorted by day of week starting from the current day (Mon → Sun, wrapping)
- Hidden entirely if no schedules exist

**3. Announcements**
- Published announcements only, newest first
- Show 3 by default; "Show more" toggle reveals the rest
- Each entry: title + truncated content (2 lines)

**4. My Courses**
- Heading: "My Courses"
- One card per `Enrollment`, ordered by `enrolledAt` descending
- Each card:
  - Course image (if set) as card thumbnail, otherwise a placeholder
  - Course title
  - Payment status badge: green "Fully Paid" or yellow "Partially Paid"
  - Progress bar: `completedLessons / totalLessons` across all subjects in the course
  - Label: "X of Y lessons completed"
  - Entire card is a link to `/student/courses/[courseId]`

**5. Payment summary** (bottom of page)
- One entry per enrollment that has `paymentStatus === 'PARTIALLY_PAID'`
- Each entry shows: course title, total paid, balance remaining, link to submit additional payment
- Section hidden entirely if all enrollments are `FULLY_PAID`

---

## Course Page (`/student/courses/[id]`)

### Data fetched
- Course (title, imageUrl, subjects with lessons and schedules and teachers)
- `LessonCompletion` rows for the current user scoped to lessons in this course

### Layout

**1. Header**
- Back link to `/student/dashboard`
- Course title
- Banner image if `imageUrl` is set

**2. Overall progress bar**
- `totalCompleted / totalLessons` across all subjects
- Label: "X of Y lessons completed"

**3. Subjects list**
- One row per subject, ordered by `Subject.order`
- Each row:
  - Subject title + description (truncated)
  - Schedule chips: day + time range for each `SubjectSchedule`
  - Mini progress bar: completed lessons / total lessons in this subject
  - Label: "X / Y lessons"
  - Full row is a link to `/student/courses/[id]/subjects/[sid]`

**4. Teachers section**
- One line per subject that has teachers assigned
- Format: `[Subject title]: [Teacher full names comma-separated]`
- Omitted entirely if no subjects have teachers assigned

---

## Subject Page (`/student/courses/[id]/subjects/[sid]`)

### Data fetched
- Subject (title, description, schedules, lessons, assessments with student's attempts)
- `LessonCompletion` rows for the current user scoped to this subject's lessons

### Layout

**1. Header**
- Breadcrumb: Dashboard → [Course title] → [Subject title]
- Subject title
- Schedule chips inline under the title

**2. Tabs: Lessons | Assessments**

---

### Lessons tab (default)

List of lessons ordered by `Lesson.order`. Each row:
- Lesson title + description (if set)
- "Materials" link — opens `materialUrl` in a new tab (hidden if null)
- "Recording" link — opens `recordingUrl` in a new tab (hidden if null)
- **"Mark as Done" / "Done ✓" toggle** on the right
  - Calls a server action that upserts/deletes a `LessonCompletion` row
  - Button reflects current completion state from the fetched data
  - Completed lessons shown with muted styling to visually distinguish them

---

### Assessments tab

List of assessments for this subject. Each row:
- Assessment title + type badge (`Quiz` / `Exam`)
- Duration label if `durationMins` is set (e.g. "30 min")
- Student's best score from past `AssessmentAttempt`s, or "Not attempted"
- "Start" button if not yet attempted (or under `maxAttempts`)
- "Retake" button if previously attempted and retakes allowed

> **Out of scope for this spec:** the take-assessment flow (question rendering, timer, submission, auto-scoring). That is a separate feature to be designed independently.

---

## Progress Computation

Progress is always computed from `LessonCompletion` — never read from `Enrollment.progress`.

```
subjectProgress = COUNT(LessonCompletion WHERE userId = X AND lessonId IN subject.lessons)
                  / COUNT(subject.lessons)

courseProgress  = SUM(subjectProgress * COUNT(subject.lessons))
                  / SUM(COUNT(subject.lessons) per subject)
               = total completed lessons in course / total lessons in course
```

---

## Server Actions

| Action | Location | Effect |
|---|---|---|
| `markLessonDoneAction` | `app/(student)/student/courses/[id]/subjects/[sid]/actions.ts` | Upsert `LessonCompletion` for (userId, lessonId) |
| `unmarkLessonDoneAction` | same file | Delete `LessonCompletion` for (userId, lessonId) |

Both revalidate the subject page and course page paths.

---

## Query Functions (new, in `lib/`)

| Function | Returns |
|---|---|
| `getStudentDashboard(userId)` | All enrollments with course progress counts, upcoming schedules, published announcements, payment status |
| `getStudentCourse(userId, courseId)` | Course + subjects + per-subject lesson completion counts + teacher assignments |
| `getStudentSubject(userId, subjectId)` | Subject + lessons with completion status + assessments with best attempt scores |

---

## Out of Scope

- Assessment taking flow (separate spec)
- Certificate download (separate spec)
- Grade display (no grades on dashboard or course page per requirements)
- Profile / password change page (already exists separately)
