# Course Image Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins upload a course image (≤ 10 MB) that displays in the admin course detail sidebar and on the public `/courses` listing.

**Architecture:** Images are stored in a separate public Supabase Storage bucket (`course-images`) at the deterministic path `courses/${courseId}/image.${ext}`. The full public URL is persisted in `Course.imageUrl` so it can be rendered anywhere without signing. Upload and removal are handled by server actions. No API routes needed.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (`@/app/generated/prisma`), Supabase Storage (`supabaseAdmin` from `@/lib/supabase/admin`), React 19 `useActionState`, shadcn/ui, Tailwind CSS 4, TypeScript.

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `imageUrl String?` to Course model |
| `lib/courses/queries.ts` | Add `imageUrl` to `CourseRow`, `CourseDetail` types and their selects |
| `lib/enrollments/queries.ts` | Add `imageUrl` to `PublishedCourseRow` type and `getPublishedCourses` select |
| `app/(admin)/admin/courses/actions.ts` | Add `uploadCourseImageAction`, `removeCourseImageAction` |
| `app/(admin)/admin/courses/[id]/course-image-card.tsx` | Create — client component for upload/remove |
| `app/(admin)/admin/courses/[id]/page.tsx` | Add `CourseImageCard` to sidebar |
| `app/(public)/courses/page.tsx` | Render image in course cards |

---

## Task 1: Add `imageUrl` to the Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the field to the Course model**

Open `prisma/schema.prisma`. Find the `Course` model (currently around line 139) and add `imageUrl String?` after `description String?`:

```prisma
model Course {
  id String @id @default(cuid())

  title       String
  description String?
  imageUrl    String?

  isPublished  Boolean @default(false)
  passingGrade Float   @default(75.0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  subjects     Subject[]
  enrollments  Enrollment[]
  certificates Certificate[]
  requests     EnrollmentRequest[]
}
```

- [ ] **Step 2: Run the migration**

```powershell
pnpm prisma migrate dev --name add-course-image-url
```

Expected output: `The following migration(s) have been created and applied from new schema changes: migrations/..._add_course_image_url`

- [ ] **Step 3: Regenerate the Prisma client**

```powershell
pnpm prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 4: Commit**

```powershell
git add prisma/schema.prisma prisma/migrations/; git commit -m "feat: add imageUrl to Course schema"
```

---

## Task 2: Update query types to include `imageUrl`

**Files:**
- Modify: `lib/courses/queries.ts`
- Modify: `lib/enrollments/queries.ts`

- [ ] **Step 1: Update `CourseRow` and `getCourses` in `lib/courses/queries.ts`**

Add `imageUrl: string | null` to `CourseRow`:

```ts
export type CourseRow = {
  id: string
  title: string
  description: string | null
  imageUrl: string | null
  isPublished: boolean
  passingGrade: number
  createdAt: Date
  _count: { subjects: number }
}
```

Add `imageUrl: true` to the `getCourses` select:

```ts
export async function getCourses(): Promise<CourseRow[]> {
  return db.course.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      isPublished: true,
      passingGrade: true,
      createdAt: true,
      _count: {
        select: { subjects: true },
      },
    },
  })
}
```

- [ ] **Step 2: Update `CourseDetail` and `getCourseById` in `lib/courses/queries.ts`**

Add `imageUrl: string | null` to `CourseDetail`:

```ts
export type CourseDetail = {
  id: string
  title: string
  description: string | null
  imageUrl: string | null
  isPublished: boolean
  passingGrade: number
  createdAt: Date
  updatedAt: Date
  subjects: SubjectRow[]
}
```

Add `imageUrl: true` to the `getCourseById` select:

```ts
export async function getCourseById(id: string): Promise<CourseDetail | null> {
  return db.course.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      isPublished: true,
      passingGrade: true,
      createdAt: true,
      updatedAt: true,
      subjects: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
          order: true,
          units: true,
          _count: {
            select: { lessons: true },
          },
        },
      },
    },
  })
}
```

- [ ] **Step 3: Update `PublishedCourseRow` and `getPublishedCourses` in `lib/enrollments/queries.ts`**

Add `imageUrl: string | null` to `PublishedCourseRow`:

```ts
export type PublishedCourseRow = {
  id: string
  title: string
  description: string | null
  imageUrl: string | null
}
```

Add `imageUrl: true` to the `getPublishedCourses` select:

```ts
export async function getPublishedCourses(): Promise<PublishedCourseRow[]> {
  return db.course.findMany({
    where: { isPublished: true },
    orderBy: { title: 'asc' },
    select: { id: true, title: true, description: true, imageUrl: true },
  })
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```powershell
pnpm build
```

Expected: build succeeds with no type errors.

- [ ] **Step 5: Commit**

```powershell
git add lib/courses/queries.ts lib/enrollments/queries.ts; git commit -m "feat: add imageUrl to course query types"
```

---

## Task 3: Add upload and remove server actions

**Files:**
- Modify: `app/(admin)/admin/courses/actions.ts`

- [ ] **Step 1: Add imports at the top of `app/(admin)/admin/courses/actions.ts`**

Add these two imports after the existing imports:

```ts
import { supabaseAdmin } from '@/lib/supabase/admin'
```

The file already imports `revalidatePath`, `redirect`, `z`, `db`, and `getSession` — do not duplicate those.

- [ ] **Step 2: Add constants before the first action**

Add these constants after the existing `type ActionState` line (before `const courseSchema`):

```ts
const MIME_EXTS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const

const MAGIC_BYTES: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
```

- [ ] **Step 3: Add `uploadCourseImageAction` at the end of the file**

```ts
export async function uploadCourseImageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  const courseId = formData.get('courseId')
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course ID.' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Please select an image file.' }

  if (!(file.type in MIME_EXTS)) {
    return { error: 'Only JPEG, PNG, and WebP images are allowed.' }
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return { error: 'Image must be 10 MB or smaller.' }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const magic = MAGIC_BYTES[file.type]!
  if (!magic.every((byte, i) => buffer[i] === byte)) {
    return { error: 'File content does not match its declared type.' }
  }

  const ext = MIME_EXTS[file.type as keyof typeof MIME_EXTS]
  const storagePath = `courses/${courseId}/image.${ext}`
  const bucket = process.env.SUPABASE_COURSE_IMAGES_BUCKET!

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(storagePath, buffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    console.error('[uploadCourseImage]', uploadError)
    return { error: 'Failed to upload image. Please try again.' }
  }

  const { data: { publicUrl } } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath)

  try {
    await db.course.update({ where: { id: courseId }, data: { imageUrl: publicUrl } })
  } catch (err) {
    console.error('[uploadCourseImage] db', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/courses/' + courseId)
  revalidatePath('/courses')
  return { error: null, success: true }
}
```

- [ ] **Step 4: Add `removeCourseImageAction` at the end of the file**

```ts
export async function removeCourseImageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return { error: 'Forbidden' }

  const courseId = formData.get('courseId')
  if (typeof courseId !== 'string' || !courseId) return { error: 'Invalid course ID.' }

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { imageUrl: true },
  })
  if (!course?.imageUrl) return { error: 'No image to remove.' }

  // Reconstruct storage path from URL suffix (format: ...courses/${courseId}/image.${ext})
  const ext = course.imageUrl.split('.').pop()
  const storagePath = `courses/${courseId}/image.${ext}`
  const bucket = process.env.SUPABASE_COURSE_IMAGES_BUCKET!

  const { error: removeError } = await supabaseAdmin.storage.from(bucket).remove([storagePath])
  if (removeError) {
    console.error('[removeCourseImage]', removeError)
    return { error: 'Failed to remove image. Please try again.' }
  }

  try {
    await db.course.update({ where: { id: courseId }, data: { imageUrl: null } })
  } catch (err) {
    console.error('[removeCourseImage] db', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidatePath('/admin/courses/' + courseId)
  revalidatePath('/courses')
  return { error: null, success: true }
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```powershell
pnpm build
```

Expected: build succeeds.

- [ ] **Step 6: Commit**

```powershell
git add app/(admin)/admin/courses/actions.ts; git commit -m "feat: add upload and remove course image actions"
```

---

## Task 4: Create `CourseImageCard` client component

**Files:**
- Create: `app/(admin)/admin/courses/[id]/course-image-card.tsx`

- [ ] **Step 1: Create the file with this exact content**

```tsx
'use client'

import { useActionState } from 'react'
import { uploadCourseImageAction, removeCourseImageAction } from '../actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type ActionState = { error: string | null; success?: boolean }

type Props = { courseId: string; imageUrl: string | null }

export function CourseImageCard({ courseId, imageUrl }: Props) {
  const [uploadState, uploadAction, isUploading] = useActionState<ActionState, FormData>(
    uploadCourseImageAction,
    { error: null },
  )
  const [removeState, removeAction, isRemoving] = useActionState<ActionState, FormData>(
    removeCourseImageAction,
    { error: null },
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Course Image</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {imageUrl && (
          <div className="space-y-2">
            <img
              src={imageUrl}
              alt="Course image"
              className="w-full rounded-md object-cover aspect-video"
            />
            <form action={removeAction}>
              <input type="hidden" name="courseId" value={courseId} />
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={isRemoving}
                className="w-full"
              >
                {isRemoving ? 'Removing...' : 'Remove Image'}
              </Button>
            </form>
            {removeState.error && (
              <p className="text-sm text-destructive">{removeState.error}</p>
            )}
          </div>
        )}
        <form action={uploadAction} className="space-y-3">
          <input type="hidden" name="courseId" value={courseId} />
          <input
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp"
            className="text-sm w-full"
            required
          />
          <Button type="submit" disabled={isUploading} className="w-full">
            {isUploading ? 'Uploading...' : imageUrl ? 'Replace Image' : 'Upload Image'}
          </Button>
        </form>
        {uploadState.error && (
          <p className="text-sm text-destructive">{uploadState.error}</p>
        )}
        {uploadState.success && !uploadState.error && (
          <p className="text-sm text-green-600">Image saved.</p>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
pnpm build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```powershell
git add "app/(admin)/admin/courses/[id]/course-image-card.tsx"; git commit -m "feat: add CourseImageCard component"
```

---

## Task 5: Wire `CourseImageCard` into the course detail page

**Files:**
- Modify: `app/(admin)/admin/courses/[id]/page.tsx`

- [ ] **Step 1: Add the import**

At the top of `app/(admin)/admin/courses/[id]/page.tsx`, add this import after the existing local imports:

```ts
import { CourseImageCard } from './course-image-card'
```

The existing imports look like:
```ts
import { EditCourseForm } from './edit-course-form'
import { TogglePublishedButton } from './toggle-published-button'
import { DeleteCourseButton } from './delete-course-button'
import { AddSubjectForm } from './add-subject-form'
```

Add `import { CourseImageCard } from './course-image-card'` after `AddSubjectForm`.

- [ ] **Step 2: Add `CourseImageCard` to the sidebar**

Find the sidebar `<div className="space-y-4">` block (currently contains only the Actions `<Card>`). Replace it with:

```tsx
<div className="space-y-4">
  <Card>
    <CardHeader>
      <CardTitle>Actions</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <TogglePublishedButton courseId={course.id} isPublished={course.isPublished} />
      <DeleteCourseButton courseId={course.id} courseTitle={course.title} />
    </CardContent>
  </Card>
  <CourseImageCard courseId={course.id} imageUrl={course.imageUrl} />
</div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```powershell
pnpm build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```powershell
git add "app/(admin)/admin/courses/[id]/page.tsx"; git commit -m "feat: add CourseImageCard to course detail sidebar"
```

---

## Task 6: Show course image on the public `/courses` listing

**Files:**
- Modify: `app/(public)/courses/page.tsx`

The public listing calls `getPublishedCourses()` from `lib/enrollments/queries.ts`, which now returns `imageUrl` after Task 2. No query changes needed here — only the JSX.

- [ ] **Step 1: Update the course card JSX**

Replace the existing course card `<div>` (the one with `className="border rounded-lg p-6 space-y-4 flex flex-col"`) with the version below. The outer `<div>` changes from `p-6` padding on the card to no padding (image bleeds to the edge), and content moves into an inner padded `<div>`:

```tsx
<div key={course.id} className="border rounded-lg overflow-hidden flex flex-col">
  {course.imageUrl && (
    <img
      src={course.imageUrl}
      alt={course.title}
      className="w-full aspect-video object-cover"
    />
  )}
  <div className="p-6 space-y-4 flex-1 flex flex-col">
    <div className="flex-1 space-y-2">
      <h2 className="text-lg font-semibold">{course.title}</h2>
      {course.description && (
        <p className="text-sm text-muted-foreground line-clamp-3">
          {course.description}
        </p>
      )}
    </div>
    <Link
      href={`/courses/${course.id}/enroll`}
      className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
    >
      Enroll Now
    </Link>
  </div>
</div>
```

The full updated `CoursesPage` component for reference:

```tsx
import Link from 'next/link'
import { getPublishedCourses } from '@/lib/enrollments/queries'

export const metadata = { title: "Courses — Al-Qur'an Academy" }

export default async function CoursesPage() {
  const courses = await getPublishedCourses()

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Courses</h1>
        <p className="text-muted-foreground mt-2">
          Browse our available courses and apply for enrollment.
        </p>
      </div>

      {courses.length === 0 ? (
        <p className="text-muted-foreground">No courses available at this time.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <div key={course.id} className="border rounded-lg overflow-hidden flex flex-col">
              {course.imageUrl && (
                <img
                  src={course.imageUrl}
                  alt={course.title}
                  className="w-full aspect-video object-cover"
                />
              )}
              <div className="p-6 space-y-4 flex-1 flex flex-col">
                <div className="flex-1 space-y-2">
                  <h2 className="text-lg font-semibold">{course.title}</h2>
                  {course.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {course.description}
                    </p>
                  )}
                </div>
                <Link
                  href={`/courses/${course.id}/enroll`}
                  className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Enroll Now
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
pnpm build
```

Expected: build succeeds with no errors.

- [ ] **Step 3: Commit**

```powershell
git add "app/(public)/courses/page.tsx"; git commit -m "feat: show course image on public courses listing"
```
