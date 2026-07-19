# Lesson Video Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional `videoUrl` Google Drive link to batch lesson content, editable by admins and playable inline by students above the existing recording.

**Architecture:** One nullable column on `BatchLessonContent`, threaded through the existing server action, admin form, two query modules, and the student lesson player.
The player's `ActiveVideo` state gains a `kind` discriminator so a lesson's video and recording can be told apart.
The Drive preview-URL helper is extracted from the player into a tested `lib` module before it gains a second consumer.

**Tech Stack:** Next.js 16 (App Router, server actions), Prisma 7 against hosted Supabase Postgres, Zod 4, Vitest (node environment), Tailwind, lucide-react icons.

## Global Constraints

- Package manager is **pnpm**. Never `npm` or `yarn`.
- Spec: `docs/superpowers/specs/2026-07-19-lesson-video-link-design.md`.
- Field name is exactly `videoUrl`. Not `lessonVideoUrl`.
- Student-facing order inside an expanded lesson: Download Material, then **Watch Lesson Video**, then **Watch Recording**.
- The lesson video must be rendered as an inline player trigger only - a `<button>`, never an `<a>` and never `target="_blank"`. This is friction, not security; do not describe it as security in code comments or UI copy.
- Existing files in this repo use **no semicolons and single quotes** in `lib/` and `app/(admin)/`, but `lesson-player.tsx` uses **semicolons and double quotes**. Match whichever file you are editing; do not reformat surrounding code.
- Migrations touch a **shared production Supabase database**. The agent must never run `prisma migrate dev`, `migrate deploy`, or `migrate reset`. Task 2 hands that to the user. Never accept a proposed database reset.

---

### Task 1: Extract the Drive preview-URL helper

Currently `toPreviewUrl` is a private function inside `lesson-player.tsx`.
Task 4 adds a second caller, so extract and test it first.
This task is a pure refactor with no behavior change.

**Files:**
- Create: `lib/batches/drive.ts`
- Create: `lib/__tests__/batches/drive.test.ts`
- Modify: `app/(student)/student/courses/[id]/subjects/[sid]/lesson-player.tsx` (remove lines 50-54, add import)

**Interfaces:**
- Consumes: nothing.
- Produces: `toPreviewUrl(url: string): string | null` exported from `@/lib/batches/drive`. Returns a `.../preview` Drive URL when the input contains a `/file/d/<id>` segment, otherwise `null`.

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/batches/drive.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toPreviewUrl } from '@/lib/batches/drive'

describe('toPreviewUrl', () => {
  it('converts a Drive view link to a preview link', () => {
    expect(toPreviewUrl('https://drive.google.com/file/d/ABC123/view?usp=sharing')).toBe(
      'https://drive.google.com/file/d/ABC123/preview',
    )
  })

  it('converts a link that is already a preview link', () => {
    expect(toPreviewUrl('https://drive.google.com/file/d/ABC123/preview')).toBe(
      'https://drive.google.com/file/d/ABC123/preview',
    )
  })

  it('returns null for a Drive link with no file id segment', () => {
    expect(toPreviewUrl('https://drive.google.com/drive/folders/XYZ')).toBeNull()
  })

  it('returns null for a non-Drive url', () => {
    expect(toPreviewUrl('https://example.com/video.mp4')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(toPreviewUrl('')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run lib/__tests__/batches/drive.test.ts`
Expected: FAIL — cannot resolve `@/lib/batches/drive`.

- [ ] **Step 3: Create the module**

Create `lib/batches/drive.ts`. This is the exact body moved from `lesson-player.tsx:50-54`:

```ts
export function toPreviewUrl(url: string): string | null {
  const match = url.match(/\/file\/d\/([^/]+)/)
  if (!match) return null
  return `https://drive.google.com/file/d/${match[1]}/preview`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run lib/__tests__/batches/drive.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Point the player at the new module**

In `app/(student)/student/courses/[id]/subjects/[sid]/lesson-player.tsx`, delete the local definition (lines 50-54):

```ts
function toPreviewUrl(url: string): string | null {
  const match = url.match(/\/file\/d\/([^/]+)/);
  if (!match) return null;
  return `https://drive.google.com/file/d/${match[1]}/preview`;
}
```

and add this import below the existing `import type { StudentLesson, ... }` line (line 16):

```ts
import { toPreviewUrl } from "@/lib/batches/drive";
```

- [ ] **Step 6: Verify nothing broke**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no errors.

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/batches/drive.ts lib/__tests__/batches/drive.test.ts "app/(student)/student/courses/[id]/subjects/[sid]/lesson-player.tsx"
git commit -m "refactor: extract toPreviewUrl into lib/batches/drive"
```

---

### Task 2: Add the `videoUrl` column

**Files:**
- Modify: `prisma/schema.prisma:265-266`

**Interfaces:**
- Consumes: nothing.
- Produces: `BatchLessonContent.videoUrl` as `String?` on the Prisma client, used by Tasks 3 and 4.

> **Read `.claude` memory `prisma-migration-workflow` before starting.**
> The database is shared and hosted. The agent cannot apply migrations - the classifier blocks DB-touching Prisma commands, and `migrate dev` has no TTY. The user runs it.

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`, inside `model BatchLessonContent`, change:

```prisma
  materialUrl  String?
  recordingUrl String?
```

to:

```prisma
  materialUrl  String?
  recordingUrl String?
  videoUrl     String?
```

- [ ] **Step 2: Ask the user to apply the migration**

Stop and tell the user verbatim:

> The schema is updated. Please run this in your own terminal, then tell me when it's done:
>
> `pnpm prisma migrate dev --name add_batch_lesson_video_url`
>
> If it reports drift and proposes a reset, do **not** accept - that would destroy production data. Tell me instead and I'll check whether this branch is behind `origin/main`.

Wait for confirmation. Do not proceed.

- [ ] **Step 3: Confirm the migration file exists**

Run: `ls prisma/migrations | tail -3`
Expected: a new folder ending in `_add_batch_lesson_video_url`.

If it is absent, the migration did not apply - do not continue, report to the user.

- [ ] **Step 4: Regenerate the client**

The user's `migrate dev` likely had its generate substep blocked, so run it yourself:

Run: `pnpm prisma generate`
Expected: "Generated Prisma Client".

- [ ] **Step 5: Prove the column reached the client**

Run: `grep -c "videoUrl" node_modules/.prisma/client/index.d.ts`
Expected: a non-zero count.

Do **not** grep `app/generated/prisma/` - it is a stale, unused leftover and will mislead you.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add videoUrl to batch lesson content"
```

---

### Task 3: Admin write path

**Files:**
- Modify: `lib/batches/actions.ts:66-90`
- Modify: `app/(admin)/admin/courses/[id]/batches/[bid]/batch-lesson-form.tsx`
- Modify: `app/(admin)/admin/courses/[id]/batches/[bid]/page.tsx:74`
- Modify: `lib/batches/queries.ts:33-38, 81`

**Interfaces:**
- Consumes: `BatchLessonContent.videoUrl` from Task 2.
- Produces: `BatchLesson.batchContent[].videoUrl` on the type exported from `@/lib/batches/queries`; a `videoUrl` prop on `<BatchLessonForm>`.

This task has no unit test - it is server-action and JSX wiring whose only meaningful verification is the end-to-end pass in Task 5. Every existing test in this repo mocks `@/lib/db`, so a mocked test here would prove nothing about the column.

- [ ] **Step 1: Widen the server action**

In `lib/batches/actions.ts`, change the Zod schema:

```ts
  const schema = z.object({
    materialUrl: z.string().optional(),
    recordingUrl: z.string().optional(),
    videoUrl: z.string().optional(),
  })
```

the parsed object:

```ts
  const result = schema.safeParse({
    materialUrl: formData.get('materialUrl'),
    recordingUrl: formData.get('recordingUrl'),
    videoUrl: formData.get('videoUrl'),
  })
```

and **both** branches of the upsert - it is easy to update only one:

```ts
      create: {
        batchId,
        lessonId,
        materialUrl: result.data.materialUrl || null,
        recordingUrl: result.data.recordingUrl || null,
        videoUrl: result.data.videoUrl || null,
      },
      update: {
        materialUrl: result.data.materialUrl || null,
        recordingUrl: result.data.recordingUrl || null,
        videoUrl: result.data.videoUrl || null,
      },
```

- [ ] **Step 2: Widen the admin query**

In `lib/batches/queries.ts`, change the `BatchLesson` type:

```ts
export type BatchLesson = {
  id: string
  title: string
  order: number
  batchContent: Array<{
    materialUrl: string | null
    recordingUrl: string | null
    videoUrl: string | null
  }>
}
```

and the `select` at line 81:

```ts
                    select: { materialUrl: true, recordingUrl: true, videoUrl: true },
```

- [ ] **Step 3: Add the form field**

In `batch-lesson-form.tsx`, add to `Props`:

```ts
  materialUrl: string | null
  videoUrl: string | null
  recordingUrl: string | null
```

add `videoUrl` to the destructured parameters alongside `materialUrl` and `recordingUrl`, widen the grid:

```tsx
      <form action={action} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
```

and insert this block **between** the Material URL `<div>` and the Recording URL `<div>`, so the field order matches the student-facing order:

```tsx
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Lesson Video URL</Label>
          <Input
            name="videoUrl"
            defaultValue={videoUrl ?? ''}
            placeholder="Google Drive link…"
            className="text-sm h-8"
          />
          <p className="text-[11px] leading-tight text-muted-foreground">
            Set Drive sharing to Viewer, and turn off download/print/copy.
          </p>
        </div>
```

- [ ] **Step 4: Pass the prop**

In `app/(admin)/admin/courses/[id]/batches/[bid]/page.tsx`, beside the existing `recordingUrl` prop at line 74:

```tsx
                        videoUrl={content?.videoUrl ?? null}
```

- [ ] **Step 5: Verify**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no errors. A "property videoUrl does not exist" error here means Task 2 Step 4 was skipped.

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/batches/actions.ts lib/batches/queries.ts "app/(admin)/admin/courses/[id]/batches/[bid]"
git commit -m "feat: admin field for lesson video url"
```

---

### Task 4: Student read path and player

**Files:**
- Modify: `lib/student/queries.ts:295-305, 393, 413`
- Modify: `app/(student)/student/courses/[id]/subjects/[sid]/lesson-player.tsx`

**Interfaces:**
- Consumes: `BatchLessonContent.videoUrl` from Task 2; `toPreviewUrl` from Task 1.
- Produces: `StudentLesson.videoUrl: string | null`.

- [ ] **Step 1: Widen the student query**

In `lib/student/queries.ts`, add to the `StudentLesson` type beside `recordingUrl` (line 299):

```ts
  videoUrl: string | null
```

change the select at line 393:

```ts
          select: { lessonId: true, materialUrl: true, recordingUrl: true, videoUrl: true },
```

and the mapping at line 413, beside the existing `recordingUrl` line:

```ts
        videoUrl: content?.videoUrl ?? null,
```

- [ ] **Step 2: Add the `kind` discriminator**

In `lesson-player.tsx`, replace the `ActiveVideo` type (lines 44-48):

```ts
type VideoKind = "video" | "recording";

type ActiveVideo = {
  lessonId: string;
  kind: VideoKind;
  title: string;
  previewUrl: string;
};
```

- [ ] **Step 3: Generalise the play handler**

Replace `playRecording` (lines 69-74):

```ts
  function playVideo(lesson: StudentLesson, kind: VideoKind) {
    const url = kind === "video" ? lesson.videoUrl : lesson.recordingUrl;
    if (!url) return;
    const previewUrl = toPreviewUrl(url);
    if (!previewUrl) return;
    setActiveVideo({ lessonId: lesson.id, kind, title: lesson.title, previewUrl });
  }
```

- [ ] **Step 4: Compute both preview URLs**

Replace the `previewUrl` / `isPlaying` block inside the `lessons.map` callback (lines 89-92):

```ts
                const videoPreviewUrl = lesson.videoUrl
                  ? toPreviewUrl(lesson.videoUrl)
                  : null;
                const recordingPreviewUrl = lesson.recordingUrl
                  ? toPreviewUrl(lesson.recordingUrl)
                  : null;
                const isPlaying = activeVideo?.lessonId === lesson.id;
```

`isPlaying` stays lesson-level here because it drives the row-header tint (line 102), which should highlight the lesson regardless of which of its videos is playing.
Per-entry state is computed in Step 5.

- [ ] **Step 5: Render both entries from one helper**

Replace the entire `{previewUrl && (...)}` button block (lines 186-207) with the two calls below.
Add this helper inside `LessonPlayer`, above the `return`:

```tsx
  function videoEntry(lesson: StudentLesson, kind: VideoKind, previewUrl: string, label: string) {
    const isActive = activeVideo?.lessonId === lesson.id && activeVideo.kind === kind;
    return (
      <button
        onClick={() => playVideo(lesson, kind)}
        className={
          "flex w-full items-center gap-2.5 px-3 py-5 text-xs font-medium text-left transition-colors hover:bg-muted/60 " +
          (isActive ? "text-primary" : "text-foreground")
        }
      >
        <PlayCircle className="flex-none w-4 h-4 text-primary" aria-hidden="true" />
        <span className="flex-1">{isActive ? "Now Playing" : label}</span>
        {isActive && (
          <span className="flex-none text-[10px] font-semibold uppercase tracking-wide text-primary">
            Live
          </span>
        )}
      </button>
    );
  }
```

and in place of the old block, in this order:

```tsx
                          {videoPreviewUrl &&
                            videoEntry(lesson, "video", videoPreviewUrl, "Watch Lesson Video")}

                          {recordingPreviewUrl &&
                            videoEntry(lesson, "recording", recordingPreviewUrl, "Watch Recording")}
```

Note `previewUrl` no longer exists as a variable - Step 4 replaced it with the two named ones.

- [ ] **Step 6: Extend the empty state**

Replace the empty-state condition (line 219):

```tsx
                          {!lesson.materialUrl &&
                            !videoPreviewUrl &&
                            !recordingPreviewUrl && (
                              <p className="px-3 py-2 text-xs text-muted-foreground">
                                No materials available.
                              </p>
                            )}
```

- [ ] **Step 7: Verify**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no errors.

Run: `pnpm lint`
Expected: no errors.

Run: `pnpm vitest run`
Expected: all pass, including Task 1's `drive.test.ts`.

- [ ] **Step 8: Commit**

```bash
git add lib/student/queries.ts "app/(student)/student/courses/[id]/subjects/[sid]/lesson-player.tsx"
git commit -m "feat: play lesson video inline above recording"
```

---

### Task 5: End-to-end verification

No code changes. This is where the feature is actually proven - the unit tests cover only `toPreviewUrl`.

**Files:** none.

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: nothing.

- [ ] **Step 1: Start the app**

Run: `pnpm dev`
Open the admin batch page for a course that has a batch with lessons.

- [ ] **Step 2: Save a video URL**

Enter a Google Drive `/file/d/<id>/view` link in the new **Lesson Video URL** field for one lesson and click Save.
Expected: "Saved" appears; the help text about Drive sharing is visible under the field; the three inputs and the Save button sit on one row at desktop width without wrapping or overflow.

- [ ] **Step 3: Confirm persistence**

Reload the page.
Expected: the video URL is still in the field. If it is empty, the `update` branch of the upsert in Task 3 Step 1 was missed.

- [ ] **Step 4: Check the student view**

Log in as a student enrolled in that batch and open the subject page. Expand the lesson.
Expected: "Watch Lesson Video" appears **above** "Watch Recording".

- [ ] **Step 5: Play and switch**

Click "Watch Lesson Video" — expected: it plays in the right-hand iframe, its label becomes "Now Playing" with the "Live" badge.
Then click "Watch Recording" — expected: the iframe swaps to the recording, "Now Playing" moves to the recording entry, and the video entry reverts to "Watch Lesson Video".
Only one entry may show "Now Playing" at a time. Both showing it means the `kind` check in Task 4 Step 5 is wrong.

- [ ] **Step 6: Check the empty states**

On a lesson with only a video and no material or recording: expected: the video entry shows and "No materials available." does **not**.
On a lesson with none of the three links: expected: "No materials available." does show.

- [ ] **Step 7: Confirm no download affordance**

Right-click the "Watch Lesson Video" entry and inspect it in devtools.
Expected: it is a `<button>`, with no `href` and no `target="_blank"`.

Then remind the user, in the final report:

> The download restriction itself is a Google Drive setting, not something this code enforces. For every lesson video file: share as **Viewer**, and uncheck "Viewers and commenters can see the option to download, print, and copy". Without that, students can still download the file.

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| Data model - `videoUrl String?`, additive migration | Task 2 |
| Write path - action, form, page, grid, help text | Task 3 |
| Read path - both query modules | Tasks 3 (admin), 4 (student) |
| Read path - `ActiveVideo.kind`, shared helper, `toPreviewUrl` reuse | Tasks 1, 4 |
| Ordering - video above recording | Task 4 Step 5, Task 3 Step 3, Task 5 Step 4 |
| Empty state extension | Task 4 Step 6 |
| Friction - inline-only, no anchor | Task 4 Step 5, verified Task 5 Step 7 |
| Drive setting is the real protection | Task 3 Step 3 help text, Task 5 Step 7 reminder |
| Testing - manual E2E list | Task 5 |
| Out of scope - no `materialUrl` change, no proxy, no tracking | not implemented anywhere |

No gaps.

**Type consistency:** `toPreviewUrl` (Task 1) is called in Task 4 Steps 3-4. `VideoKind` is defined in Task 4 Step 2 and used in Steps 3 and 5. `playVideo(lesson, kind)` is defined in Step 3 and called in Step 5. `videoPreviewUrl` / `recordingPreviewUrl` are defined in Step 4 and used in Steps 5-6; the old `previewUrl` is explicitly noted as removed. `videoUrl` is spelled identically in the schema, action, both query modules, both types, and the form input `name`.

**Note on a spec deviation:** the spec's read-path section implies a single shared `isPlaying`. The plan splits it - lesson-level `isPlaying` for the row-header tint, per-entry `isActive` inside the helper. Without that split the row tint would break when the discriminator was added. This is a refinement, not a change in behavior.
