# Course Image Upload Design

**Date:** 2026-06-21
**Status:** Approved
**Scope:** Admin can upload a course image (≤ 10 MB); image displays on the admin course detail page and on the public `/courses` listing.

---

## Overview

Admins upload a course image from the course detail page (`/admin/courses/[id]`). The image is stored in a dedicated **public** Supabase Storage bucket (`course-images`) so a stable public URL can be stored directly in the `Course` record and used anywhere without signing. The image appears as a thumbnail in the admin sidebar and as a card image on the public course listing.

---

## 1. Schema

Add one nullable field to the `Course` model in `prisma/schema.prisma`:

```prisma
model Course {
  // ... existing fields ...
  imageUrl  String?
}
```

A new migration applies the change: `pnpm prisma migrate dev --name add-course-image-url`.

---

## 2. Storage

- **Bucket:** `course-images` (public bucket — already created by user)
- **Env var:** `SUPABASE_COURSE_IMAGES_BUCKET` (already added to `.env`)
- **Path:** `courses/${courseId}/image.${ext}` where `ext` is `jpg`, `png`, or `webp`
- **Upsert:** `upsert: true` so re-uploads silently overwrite the previous file

Public URL retrieved via:
```ts
supabaseAdmin.storage.from(process.env.SUPABASE_COURSE_IMAGES_BUCKET!).getPublicUrl(path).data.publicUrl
```

No signed URLs needed — the bucket is public.

---

## 3. Data Layer

### `lib/courses/queries.ts`

- Add `imageUrl: string | null` to `CourseRow` type and `getCourses` select
- Add `imageUrl: string | null` to `CourseDetail` type and `getCourseById` select

### `app/(admin)/admin/courses/actions.ts`

**`uploadCourseImageAction(_prev, formData)`**
- Input: `courseId` (hidden string), `file` (File)
- Guards: `getSession()` → must be ADMIN or SUPER_ADMIN
- Validate:
  - File must exist
  - MIME type must be `image/jpeg`, `image/png`, or `image/webp`
  - Magic bytes confirmed (JPEG: `FF D8 FF`; PNG: `89 50 4E 47`; WebP: `52 49 46 46` … `57 45 42 50`)
  - Size ≤ 10 MB (10 × 1024 × 1024 bytes)
- Upload: `Buffer.from(await file.arrayBuffer())` → `supabaseAdmin.storage.from(bucket).upload(path, buffer, { contentType, upsert: true })`
- Get URL: `supabaseAdmin.storage.from(bucket).getPublicUrl(path).data.publicUrl`
- DB: `db.course.update({ where: { id: courseId }, data: { imageUrl: publicUrl } })`
- Revalidate `/admin/courses/${courseId}` and `/courses`
- Returns `{ error: null, success: true }` or `{ error: string }`

**`removeCourseImageAction(_prev, formData)`**
- Input: `courseId` (hidden string)
- Guards: same as above
- Fetch current `imageUrl` from DB — return error if no image
- Delete from storage: `supabaseAdmin.storage.from(bucket).remove([storagePath])`
  - Storage path: `courses/${courseId}/image.${ext}` where `ext` is determined by checking the `imageUrl` suffix (ends with `.jpg`, `.png`, or `.webp`)
- DB: `db.course.update({ where: { id: courseId }, data: { imageUrl: null } })`
- Revalidate both paths
- Returns `{ error: null, success: true }` or `{ error: string }`

---

## 4. UI Components

### `app/(admin)/admin/courses/[id]/course-image-card.tsx` — `'use client'`

Props:
```ts
type Props = { courseId: string; imageUrl: string | null }
```

Behaviour:
- Upload form: `useActionState(uploadCourseImageAction, { error: null })`
  - Hidden `<input name="courseId" value={courseId} />`
  - `<input type="file" name="file" accept="image/jpeg,image/png,image/webp" />`
  - Submit button: "Upload Image" / "Uploading…" while pending
- If `imageUrl` is set:
  - Show `<img src={imageUrl} alt="Course image" className="rounded-md w-full object-cover aspect-video" />`
  - Remove form: `useActionState(removeCourseImageAction, { error: null })`
    - Hidden `<input name="courseId" value={courseId} />`
    - Button: "Remove Image" (destructive variant)
- Error message below on failure; "Saved." on success

### `app/(admin)/admin/courses/[id]/page.tsx`

Modify sidebar (`lg:col-span-1` column):
- Add `<CourseImageCard courseId={course.id} imageUrl={course.imageUrl} />` as a second card below the existing Actions card
- No server-side signed URL needed — `imageUrl` is a stable public URL

---

## 5. Public `/courses` Page

`app/(public)/courses/page.tsx` — each course card conditionally renders the image:

```tsx
{course.imageUrl && (
  <img
    src={course.imageUrl}
    alt={course.title}
    className="w-full aspect-video object-cover rounded-t-lg"
  />
)}
```

Cards without an image show no image area (no placeholder needed — keeps the UI clean).

---

## 6. Files Changed / Created

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Modify — add `imageUrl String?` to Course |
| `lib/courses/queries.ts` | Modify — add `imageUrl` to `CourseRow`, `CourseDetail`, their selects |
| `app/(admin)/admin/courses/actions.ts` | Modify — add `uploadCourseImageAction`, `removeCourseImageAction` |
| `app/(admin)/admin/courses/[id]/course-image-card.tsx` | Create — upload/remove UI card |
| `app/(admin)/admin/courses/[id]/page.tsx` | Modify — render `CourseImageCard` in sidebar |
| `app/(public)/courses/page.tsx` | Modify — render image in course card when present |

---

## 7. Out of Scope

- Image cropping or resizing (upload as-is)
- Showing image on the individual course enroll page (`/courses/[id]/enroll`)
- Admin course listing thumbnail (only the detail page and public listing)
- Progress bar for upload (10 MB via server action is acceptable)
- Alt text configured by admin (uses course title as alt text)
