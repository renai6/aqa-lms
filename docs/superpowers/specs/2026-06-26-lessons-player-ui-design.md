# Lessons Player UI Design

**Date:** 2026-06-26
**Status:** Approved

## Summary

Redesign the student subject page (`/student/courses/[id]/subjects/[sid]`) from a flat scrollable lesson list into a two-panel layout: a scrollable sidebar on the left listing lessons as an accordion, and a Google Drive iframe video player on the right. Clicking a lesson expands it to reveal Download Material and Watch Recording actions. Clicking Watch Recording loads the video in the right panel without a page reload.

---

## Layout

```
┌──────────────────────────────────────────────────────┐
│  ← Course Title                    Subject Title     │  thin header bar
├───────────────────┬──────────────────────────────────┤
│                   │                                  │
│  SIDEBAR (left)   │     VIDEO PLAYER (right)         │
│  ~320px fixed     │     fills remaining width        │
│  scrollable       │                                  │
│                   │  [placeholder when none active]  │
│  1. Lesson One  ▼ │  [iframe when recording active]  │
│    📥 Material    │                                  │
│    ▶ Recording    │                                  │
│  2. Lesson Two  ▶ │                                  │
│  3. Lesson Three▶ │                                  │
│                   │                                  │
│  ─────────────    │                                  │
│  View Assessments │                                  │
└───────────────────┴──────────────────────────────────┘
```

- **Header bar**: slim top strip with a back link (← subject/course title) and the subject title. Replaces the current padded hero area.
- **Sidebar** (~320px, fixed width, full-height scrollable): ordered lesson list as an accordion. Only one lesson open at a time. At the bottom: a "View Assessments →" link.
- **Player panel** (fills remaining width): shows a centered placeholder by default; shows a full-size `<iframe>` with lesson title above it when a recording is active.
- **Mobile** (`< lg` breakpoint): panels stack vertically — sidebar on top, player below. Selecting a recording auto-scrolls to the player.

---

## Components

### `page.tsx` (Server Component — modified)

- Fetches `StudentSubject` via existing `getStudentSubject(userId, sid)` — no query changes needed.
- Renders the two-panel shell (header + sidebar shell + player shell).
- Passes `lessons`, `subjectId`, `courseId` as props to `<LessonPlayer>`.
- Removes `<TabSwitcher>` and the assessments tab block.
- Adds a "View Assessments" link at the bottom of the sidebar area pointing to `?tab=assessments` or a dedicated route (TBD based on existing patterns — simplest is to keep a separate assessments page or render them below the sidebar link).

### `lesson-player.tsx` (New — `'use client'`)

Manages all interactive state:

```ts
expandedId: string | null       // which accordion row is open
activeVideo: {
  lessonId: string
  title: string
  previewUrl: string            // converted Google Drive preview URL
} | null
```

Renders:
- Left panel: lesson accordion list + "View Assessments" footer link
- Right panel: placeholder or `<iframe src={activeVideo.previewUrl}>`

### `lesson-done-button.tsx` (unchanged)

Kept as-is. Rendered inside each accordion row in the sidebar.

### `tab-switcher.tsx` (removed)

No longer needed — tabs replaced by the two-panel layout.

---

## Google Drive URL Conversion

A pure utility function (no API call, no network):

```ts
function toPreviewUrl(url: string): string | null {
  const match = url.match(/\/file\/d\/([^/]+)/)
  if (!match) return null
  return `https://drive.google.com/file/d/${match[1]}/preview`
}
```

- Input: any Google Drive share URL (`/file/d/FILE_ID/view`, `/file/d/FILE_ID/view?usp=sharing`, etc.)
- Output: `https://drive.google.com/file/d/FILE_ID/preview` (embeddable in an `<iframe>`)
- Returns `null` for unrecognised URL formats; the Watch Recording button is hidden in that case.

---

## Sidebar Accordion — Lesson Row Behaviour

Each lesson row:
- Shows: lesson number, title, completion checkmark (if `isCompleted`), expand chevron
- Clicking the row toggles `expandedId` (collapse if already open, open otherwise)
- Expanded state shows:
  - **Download Material** button — only if `materialUrl` is set; opens in a new tab (`target="_blank" rel="noopener noreferrer"`)
  - **Watch Recording** button — only if `recordingUrl` is set AND `toPreviewUrl(recordingUrl)` returns non-null; sets `activeVideo` state
- `LessonDoneButton` rendered inside the expanded row

---

## Player Panel

- **Default (no video selected):** centred placeholder with a play icon and text "Select a lesson to watch".
- **Active video:** `<iframe>` fills the panel, `allow="autoplay"` attribute set, `allowFullScreen`. Lesson title shown above the iframe in a small header strip.
- iframe `src` is set to `activeVideo.previewUrl` (the `/preview` URL).

---

## Data Flow

No new queries or schema changes required. `StudentLesson` already has:
- `id`, `title`, `order`, `materialUrl`, `recordingUrl`, `isCompleted`

`page.tsx` passes the full `lessons` array and `subject` metadata to `LessonPlayer` as props.

---

## Files Affected

| File | Change |
|------|--------|
| `app/(student)/student/courses/[id]/subjects/[sid]/page.tsx` | Restructure to two-panel shell; remove TabSwitcher + assessments tab block; render `<LessonPlayer>` |
| `app/(student)/student/courses/[id]/subjects/[sid]/lesson-player.tsx` | **New** — full client component with accordion + iframe state |
| `app/(student)/student/courses/[id]/subjects/[sid]/tab-switcher.tsx` | **Delete** |

---

## Out of Scope

- Assessments UI redesign (separate spec)
- Progress tracking changes (LessonDoneButton works as-is)
- Any changes to admin lesson management
- Offline video support or non-Google Drive players
