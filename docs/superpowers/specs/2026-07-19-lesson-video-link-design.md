# Lesson Video Link

## Problem

A batch lesson currently carries two optional Google Drive links: `materialUrl` (downloadable handout) and `recordingUrl` (recording of the live session).
There is no place to attach the taught lesson video itself - the prepared content a student watches, as distinct from the artifact of a live session.

## Goal

Add a third optional Google Drive link, `videoUrl`, to batch lesson content.
Students play it inline in the existing player. Admins set it in the existing per-batch lesson form.

## Scope of protection

Students must not be able to download the lesson video.
This cannot be enforced in application code: the `<iframe>` `src` must be a `drive.google.com` URL, so the file ID is always readable from the DOM, and anyone can open the file directly in Drive.

Enforcement therefore lives in Google Drive, not in this codebase:

- Share the file as **Viewer** only.
- Uncheck **"Viewers and commenters can see the option to download, print, and copy"** in the file's share settings.

The application contributes friction only: the video is rendered as an inline player trigger, never as an anchor or `target="_blank"` link, so the URL is not a clickable affordance anywhere in the UI.
The existing recording link already meets this bar - it is a `<button>` that sets player state, not an anchor - so it needs no change.
This friction is explicitly not a security boundary and must not be described as one.

A server-side proxy that hides the Drive URL entirely was considered and rejected: it breaks Drive's adaptive streaming, adds significant bandwidth and complexity, and still does not prevent screen recording.

## Data model

Add one nullable column to `BatchLessonContent` in `prisma/schema.prisma`:

```prisma
materialUrl  String?
recordingUrl String?
videoUrl     String?
```

The field is named `videoUrl` rather than `lessonVideoUrl`; the model is already lesson-scoped, so the prefix is redundant.

The migration is purely additive.
Existing rows receive `NULL` and continue to behave exactly as they do today.

## Write path (admin)

`lib/batches/actions.ts` - widen the existing pair to a triple:

- add `videoUrl: z.string().optional()` to the Zod schema
- add `videoUrl: formData.get('videoUrl')` to the parsed object
- add `videoUrl: result.data.videoUrl || null` to both the `create` and `update` branches of the `upsert`

`app/(admin)/admin/courses/[id]/batches/[bid]/batch-lesson-form.tsx`:

- add a `videoUrl: string | null` prop
- add a third `<Input name="videoUrl">` between the material and recording fields, matching their existing styling
- change the form grid from `sm:grid-cols-[1fr_1fr_auto]` to `sm:grid-cols-[1fr_1fr_1fr_auto]`
- add help text beneath the video field: "Set Drive sharing to Viewer, and turn off download/print/copy."
  The actual protection depends on this being done, so the instruction belongs next to the field that needs it.

`app/(admin)/admin/courses/[id]/batches/[bid]/page.tsx` - pass `videoUrl={content?.videoUrl ?? null}` to the form.

## Read path (student)

`lib/batches/queries.ts` and `lib/student/queries.ts` - add `videoUrl` to both Prisma `select` clauses and to both exported types (`StudentLesson`, and the batch content type).

`app/(student)/student/courses/[id]/subjects/[sid]/lesson-player.tsx` carries the only non-mechanical change.

`ActiveVideo` is currently keyed by `lessonId` alone, which cannot distinguish two videos belonging to the same lesson.
Add a discriminator:

```ts
type ActiveVideo = {
  lessonId: string
  kind: 'video' | 'recording'
  title: string
  previewUrl: string
}
```

Consequently:

- `playRecording(lesson)` generalises to `playVideo(lesson, kind)`
- the "now playing" test becomes `activeVideo?.lessonId === lesson.id && activeVideo.kind === kind`
- the two player entries render from one shared helper rather than duplicated JSX

`toPreviewUrl` is unchanged and applies to both URLs.
The iframe is keyed on `previewUrl`, so switching between a lesson's video and its recording remounts the player correctly.

Order within the expanded lesson row:

1. Download Material
2. Watch Lesson Video
3. Watch Recording

Video precedes recording because it is the taught content; the recording is the session artifact.

The empty state check extends from `!lesson.materialUrl && !previewUrl` to also require the absence of a video preview URL, so a lesson carrying only a video does not render "No materials available."

## Testing

Manual end-to-end verification against the running app:

- Set a video URL on a batch lesson in admin, save, and confirm it persists on reload.
- Load the student subject page and confirm the "Watch Lesson Video" entry appears above "Watch Recording".
- Play the video, then the recording, and confirm the iframe swaps and the "Now Playing" highlight moves to the correct entry.
- Load a lesson carrying only a video and confirm the empty state does not appear.
- Load a lesson carrying none of the three links and confirm the empty state does appear.

## Out of scope

- Any change to how `materialUrl` behaves.
- Server-side proxying or DRM.
- Per-student access logging or view tracking.
