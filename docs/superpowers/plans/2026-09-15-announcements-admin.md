# Announcements Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins create, target, illustrate, publish, pin and delete announcements, and students see every announcement meant for them.

**Architecture:** The schema gains an audience enum, an image URL, `publishedAt`, `isPinned` and an `AnnouncementCourse` join table.
All logic lives in `lib/announcements/` (pure validation, formatting and picker helpers, Supabase storage helpers, Prisma queries, server actions), with thin pages in `app/(admin)/admin/announcements/` and `app/(student)/student/announcements/`.
Course lists are replaced with a Prisma nested write (`deleteMany` + `create` inside one `update`), which Prisma runs in a single transaction, so no explicit `$transaction` is needed.

**Tech Stack:** Next.js 16 App Router with server actions, React 19, Prisma 7 on Supabase Postgres, Supabase Storage, Zod 4, Tailwind, lucide-react, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-15-announcements-admin-design.md`

## Global Constraints

- Package manager is pnpm only.
- Never use the em dash character in code, copy or commit messages; use a plain "-".
New metadata titles read `Announcements - AQA Admin` and `Announcements - AQA Student`.
- Commit messages carry no `Co-Authored-By` line.
- Never run `pnpm prisma format` or `prettier --write` on existing files; hand-align schema fields.
- `prisma migrate dev` cannot run in the agent sandbox; the user runs it in their own terminal (see Task 1).
- Do not touch `app/generated/prisma/` (stale, unused), any CHANGELOG, or the untracked files under `docs/` other than this plan and the spec.
- New files use single quotes and no semicolons, like `lib/batches/actions.ts`.
- Admin-only actions allow roles `ADMIN` and `SUPER_ADMIN`, returning `{ error: 'Unauthorized' }` with no session and `{ error: 'Forbidden' }` for other roles.
- Limits: title 200 characters, content 5,000 characters, image JPG, PNG or WEBP up to 10 MB, dashboard shows 3 announcements.
- Images live in the `SUPABASE_COURSE_IMAGES_BUCKET` bucket at `announcements/{randomUUID}.{ext}`.
- Student visibility must reuse `ACTIVE_COURSE` (`lib/courses/archive.ts`) and `ACTIVE_ENROLLMENT` (`lib/enrollments/active.ts`).
- Dates shown to users are formatted in `Asia/Manila`.

## File Structure

| File | Responsibility |
| --- | --- |
| `prisma/schema.prisma` | Modify: `AnnouncementAudience`, new `Announcement` fields, `AnnouncementCourse`, `Course.announcements` |
| `prisma/migrations/<timestamp>_announcements_admin/migration.sql` | Create (generated, plus one hand-written backfill) |
| `lib/announcements/limits.ts` | Create: `TITLE_MAX`, `CONTENT_MAX`, shared by form and schema |
| `lib/announcements/validation.ts` | Create: Zod schema and `parseAnnouncementForm` |
| `lib/announcements/format.ts` | Create: `audienceSummary`, `formatAnnouncementDate` |
| `lib/announcements/picker.ts` | Create: pure group checkbox helpers |
| `lib/announcements/storage.ts` | Create: upload, remove, `storagePathFromPublicUrl` |
| `lib/announcements/queries.ts` | Create: student, admin, edit and course option queries |
| `lib/announcements/actions.ts` | Create: `saveAnnouncementAction`, `deleteAnnouncementAction` |
| `lib/student/queries.ts` | Modify: dashboard delegates to `getStudentAnnouncements` |
| `app/(admin)/layout.tsx` | Modify: sidebar item |
| `app/(admin)/admin/announcements/page.tsx` | Create: list |
| `app/(admin)/admin/announcements/loading.tsx` | Create |
| `app/(admin)/admin/announcements/announcement-form.tsx` | Create: shared client form with course picker |
| `app/(admin)/admin/announcements/new/page.tsx` | Create |
| `app/(admin)/admin/announcements/[id]/page.tsx` | Create: edit |
| `app/(admin)/admin/announcements/[id]/loading.tsx` | Create |
| `app/(admin)/admin/announcements/[id]/delete-announcement-button.tsx` | Create |
| `components/student/announcement-card.tsx` | Create: compact and full cards |
| `components/student/nav.tsx` | Modify: nav link |
| `app/(student)/student/dashboard/page.tsx` | Modify: announcements section |
| `app/(student)/student/announcements/page.tsx` | Create |
| `app/(student)/student/announcements/loading.tsx` | Create |
| `lib/__tests__/announcements/*.test.ts` | Create: unit tests |

---

### Task 1: Schema and migration

**Files:**
- Modify: `prisma/schema.prisma` (the `Announcement` model near line 639, and `model Course` relations near line 211)
- Create: `prisma/migrations/<timestamp>_announcements_admin/migration.sql` (generated)
- Create then delete: `scripts/verify-announcements.ts`

**Interfaces:**
- Produces: Prisma types `AnnouncementAudience` (`'EVERYONE' | 'COURSES'`), `Announcement` with `imageUrl: string | null`, `audience`, `publishedAt: Date | null`, `isPinned: boolean`, relation `courses`, and `AnnouncementCourse { announcementId, courseId }`; `db.announcementCourse` delegate.

- [ ] **Step 1: Edit the schema**

Replace the whole existing `model Announcement { ... }` block with:

```prisma
enum AnnouncementAudience {
  EVERYONE
  COURSES
}

model Announcement {
  id String @id @default(cuid())

  title    String
  content  String
  imageUrl String?

  // EVERYONE ignores `courses`. COURSES reaches only students actively
  // enrolled in one of `courses`. Kept separate from the join rows so a
  // targeted announcement that loses its courses never widens to everyone.
  audience AnnouncementAudience @default(EVERYONE)

  isPublished Boolean   @default(false)
  // Set on the first publish and never cleared, so unpublishing to fix a
  // typo and publishing again does not jump the announcement back to the top.
  publishedAt DateTime?
  isPinned    Boolean   @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  courses AnnouncementCourse[]
}

model AnnouncementCourse {
  announcementId String
  announcement   Announcement @relation(fields: [announcementId], references: [id], onDelete: Cascade)
  courseId       String
  course         Course       @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@id([announcementId, courseId])
  @@index([courseId])
}
```

In `model Course`, add one line after `batches       Batch[]`, aligned with its neighbours:

```prisma
  announcements AnnouncementCourse[]
```

- [ ] **Step 2: Regenerate the client and type-check**

Run: `pnpm prisma generate && ./node_modules/.bin/tsc --noEmit`
Expected: generate succeeds; tsc reports no errors (the existing dashboard query only selects fields that still exist).

- [ ] **Step 3: Ask the user to create the migration**

Stop and ask the user to run, in their own terminal:

```bash
pnpm prisma migrate dev --create-only --name announcements_admin
```

Then confirm a new untracked folder `prisma/migrations/<timestamp>_announcements_admin/` exists.
If Prisma reports drift and proposes a reset, tell the user to refuse it and sync the branch with `origin/main` first.

- [ ] **Step 4: Append the backfill to the generated SQL**

Append to the end of `prisma/migrations/<timestamp>_announcements_admin/migration.sql`:

```sql
-- Existing published announcements keep their order: they are dated by
-- when they were created, since they predate publishedAt.
UPDATE "Announcement" SET "publishedAt" = "createdAt" WHERE "isPublished" = true;
```

Read the whole generated file and check it only creates the enum, adds the four columns, creates `AnnouncementCourse` with its index and two foreign keys, and ends with the `UPDATE`.

- [ ] **Step 5: Ask the user to apply it**

Stop and ask the user to run `pnpm prisma migrate dev` in their own terminal.
Afterwards run `pnpm prisma generate` yourself.

- [ ] **Step 6: Prove the tables exist on the real database**

Create `scripts/verify-announcements.ts`:

```ts
import 'dotenv/config'

async function main() {
  const { db } = await import('../lib/db')
  const rows = await db.announcement.findMany({
    select: { isPublished: true, publishedAt: true, audience: true, isPinned: true, imageUrl: true },
  })
  const links = await db.announcementCourse.count()
  console.log({
    announcements: rows.length,
    links,
    publishedWithoutDate: rows.filter((r) => r.isPublished && !r.publishedAt).length,
  })
  await db.$disconnect()
}

main()
```

Run: `pnpm exec tsx scripts/verify-announcements.ts`
Expected: an object printed with `publishedWithoutDate: 0` and no error.
Delete the script afterwards: `rm scripts/verify-announcements.ts`.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(announcements): add audience, image, pinning and course targeting to the schema"
```

---

### Task 2: Storage helpers

**Files:**
- Create: `lib/announcements/storage.ts`
- Test: `lib/__tests__/announcements/storage.test.ts`

**Interfaces:**
- Consumes: `supabaseAdmin` from `@/lib/supabase/admin`.
- Produces:
  - `storagePathFromPublicUrl(publicUrl: string): string | null`
  - `uploadAnnouncementImage(image: { buffer: Buffer; ext: string; contentType: string }): Promise<string>` - resolves the public URL, throws on upload failure.
  - `removeAnnouncementImage(publicUrl: string): Promise<void>` - never throws; logs failures.

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/announcements/storage.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const storage = vi.hoisted(() => ({
  from: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  getPublicUrl: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { storage: { from: storage.from } },
}))

import {
  storagePathFromPublicUrl,
  uploadAnnouncementImage,
  removeAnnouncementImage,
} from '@/lib/announcements/storage'

const BASE = 'https://abc.supabase.co/storage/v1/object/public'

describe('announcement storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('SUPABASE_COURSE_IMAGES_BUCKET', 'course-images')
    storage.from.mockReturnValue({
      upload: storage.upload,
      remove: storage.remove,
      getPublicUrl: storage.getPublicUrl,
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('storagePathFromPublicUrl', () => {
    it('maps a public bucket URL to its object path', () => {
      expect(storagePathFromPublicUrl(`${BASE}/course-images/announcements/abc.png`)).toBe(
        'announcements/abc.png',
      )
    })

    // Guards the shared bucket: a bad URL must never resolve to a course image.
    it('refuses paths outside announcements/', () => {
      expect(storagePathFromPublicUrl(`${BASE}/course-images/courses/c1/image.png`)).toBeNull()
    })

    it('refuses another bucket and non-URLs', () => {
      expect(storagePathFromPublicUrl(`${BASE}/proofs/announcements/abc.png`)).toBeNull()
      expect(storagePathFromPublicUrl('not a url')).toBeNull()
    })
  })

  describe('uploadAnnouncementImage', () => {
    it('stores under a fresh announcements/ name and returns the public URL', async () => {
      storage.upload.mockResolvedValue({ error: null })
      storage.getPublicUrl.mockImplementation((path: string) => ({
        data: { publicUrl: `${BASE}/course-images/${path}` },
      }))

      const url = await uploadAnnouncementImage({
        buffer: Buffer.from([1]),
        ext: 'png',
        contentType: 'image/png',
      })

      expect(storage.from).toHaveBeenCalledWith('course-images')
      const [path, , options] = storage.upload.mock.calls[0]
      expect(path).toMatch(/^announcements\/[0-9a-f-]{36}\.png$/)
      expect(options).toEqual({ contentType: 'image/png', upsert: false })
      expect(url).toBe(`${BASE}/course-images/${path}`)
    })

    it('throws when the upload fails', async () => {
      storage.upload.mockResolvedValue({ error: new Error('boom') })
      await expect(
        uploadAnnouncementImage({ buffer: Buffer.from([1]), ext: 'png', contentType: 'image/png' }),
      ).rejects.toThrow('boom')
    })
  })

  describe('removeAnnouncementImage', () => {
    it('removes the object behind the URL', async () => {
      storage.remove.mockResolvedValue({ error: null })
      await removeAnnouncementImage(`${BASE}/course-images/announcements/abc.png`)
      expect(storage.remove).toHaveBeenCalledWith(['announcements/abc.png'])
    })

    it('logs and resolves when Supabase reports an error', async () => {
      storage.remove.mockResolvedValue({ error: new Error('nope') })
      await expect(
        removeAnnouncementImage(`${BASE}/course-images/announcements/abc.png`),
      ).resolves.toBeUndefined()
      expect(console.error).toHaveBeenCalled()
    })

    it('logs and resolves when the call throws', async () => {
      storage.remove.mockRejectedValue(new Error('network'))
      await expect(
        removeAnnouncementImage(`${BASE}/course-images/announcements/abc.png`),
      ).resolves.toBeUndefined()
      expect(console.error).toHaveBeenCalled()
    })

    it('does nothing for a URL outside announcements/', async () => {
      await removeAnnouncementImage(`${BASE}/course-images/courses/c1/image.png`)
      expect(storage.remove).not.toHaveBeenCalled()
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run lib/__tests__/announcements/storage.test.ts`
Expected: FAIL, cannot resolve `@/lib/announcements/storage`.

- [ ] **Step 3: Implement**

Create `lib/announcements/storage.ts`:

```ts
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Announcement images share the public course images bucket, kept apart by
// the announcements/ prefix. Every upload gets a fresh name, so a replaced
// image is never served from a stale cache.
const PREFIX = 'announcements/'

function bucket(): string {
  return process.env.SUPABASE_COURSE_IMAGES_BUCKET!
}

// Returns null for anything that is not an announcement object in our bucket,
// so a malformed URL can never delete a course image.
export function storagePathFromPublicUrl(publicUrl: string): string | null {
  let pathname: string
  try {
    pathname = new URL(publicUrl).pathname
  } catch {
    return null
  }
  const marker = `/storage/v1/object/public/${bucket()}/`
  const start = pathname.indexOf(marker)
  if (start === -1) return null
  const path = decodeURIComponent(pathname.slice(start + marker.length))
  return path.startsWith(PREFIX) ? path : null
}

export async function uploadAnnouncementImage(image: {
  buffer: Buffer
  ext: string
  contentType: string
}): Promise<string> {
  const path = `${PREFIX}${randomUUID()}.${image.ext}`
  const { error } = await supabaseAdmin.storage
    .from(bucket())
    .upload(path, image.buffer, { contentType: image.contentType, upsert: false })
  if (error) throw error
  return supabaseAdmin.storage.from(bucket()).getPublicUrl(path).data.publicUrl
}

// Best effort: an orphaned file is harmless, so a failed removal is logged
// and never fails the save or delete that triggered it.
export async function removeAnnouncementImage(publicUrl: string): Promise<void> {
  const path = storagePathFromPublicUrl(publicUrl)
  if (!path) {
    console.error('[removeAnnouncementImage] not an announcement image', publicUrl)
    return
  }
  try {
    const { error } = await supabaseAdmin.storage.from(bucket()).remove([path])
    if (error) console.error('[removeAnnouncementImage]', error)
  } catch (err) {
    console.error('[removeAnnouncementImage]', err)
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run lib/__tests__/announcements/storage.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/announcements/storage.ts lib/__tests__/announcements/storage.test.ts
git commit -m "feat(announcements): add image storage helpers"
```

---

### Task 3: Validation, formatting and picker helpers

**Files:**
- Create: `lib/announcements/limits.ts`, `lib/announcements/validation.ts`, `lib/announcements/format.ts`, `lib/announcements/picker.ts`
- Test: `lib/__tests__/announcements/validation.test.ts`, `lib/__tests__/announcements/format.test.ts`, `lib/__tests__/announcements/picker.test.ts`

**Interfaces:**
- Produces:
  - `TITLE_MAX = 200`, `CONTENT_MAX = 5000`
  - `type AnnouncementInput = { id?: string; title: string; content: string; audience: 'EVERYONE' | 'COURSES'; courseIds: string[]; isPinned: boolean; removeImage: boolean; intent: 'save' | 'publish' | 'unpublish' }`
  - `parseAnnouncementForm(formData: FormData): { ok: true; data: AnnouncementInput } | { ok: false; error: string }`
  - `audienceSummary(audience: AnnouncementAudience, courseTitles: string[]): string`
  - `formatAnnouncementDate(date: Date): string`
  - `type GroupCheckState = 'all' | 'some' | 'none'`
  - `groupCheckState(levelIds: readonly string[], selected: ReadonlySet<string>): GroupCheckState`
  - `toggleGroup(levelIds: readonly string[], selected: ReadonlySet<string>): Set<string>`
  - `toggleCourse(id: string, selected: ReadonlySet<string>): Set<string>`

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/announcements/validation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseAnnouncementForm } from '@/lib/announcements/validation'

function form(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData()
  const base = { title: 'Eid break', content: 'Classes resume Monday.', audience: 'EVERYONE', intent: 'save' }
  for (const [key, value] of Object.entries({ ...base, ...fields })) {
    if (Array.isArray(value)) value.forEach((v) => fd.append(key, v))
    else fd.set(key, value)
  }
  return fd
}

function errorOf(fd: FormData): string | undefined {
  const result = parseAnnouncementForm(fd)
  return result.ok ? undefined : result.error
}

describe('parseAnnouncementForm', () => {
  it('parses a minimal everyone announcement', () => {
    const result = parseAnnouncementForm(form({ title: '  Eid break  ', content: ' Resume Monday. ' }))
    expect(result).toEqual({
      ok: true,
      data: {
        id: undefined,
        title: 'Eid break',
        content: 'Resume Monday.',
        audience: 'EVERYONE',
        courseIds: [],
        isPinned: false,
        removeImage: false,
        intent: 'save',
      },
    })
  })

  it('reads the id and checkboxes', () => {
    const result = parseAnnouncementForm(form({ id: 'a1', isPinned: 'on', removeImage: 'on' }))
    expect(result.ok && result.data).toMatchObject({ id: 'a1', isPinned: true, removeImage: true })
  })

  it('requires a title', () => {
    expect(errorOf(form({ title: '   ' }))).toBe('Title is required.')
  })

  it('caps the title at 200 characters', () => {
    expect(errorOf(form({ title: 'a'.repeat(200) }))).toBeUndefined()
    expect(errorOf(form({ title: 'a'.repeat(201) }))).toBe('Title must be 200 characters or fewer.')
  })

  it('requires content', () => {
    expect(errorOf(form({ content: '' }))).toBe('Content is required.')
  })

  it('caps content at 5,000 characters', () => {
    expect(errorOf(form({ content: 'a'.repeat(5001) }))).toBe('Content must be 5,000 characters or fewer.')
  })

  it('requires an audience', () => {
    const fd = form({})
    fd.delete('audience')
    expect(errorOf(fd)).toBe('Please choose an audience.')
  })

  it('requires at least one course for a course audience', () => {
    expect(errorOf(form({ audience: 'COURSES' }))).toBe('Choose at least one course.')
  })

  it('collects every course id once', () => {
    const result = parseAnnouncementForm(form({ audience: 'COURSES', courseIds: ['c1', 'c2', 'c1'] }))
    expect(result.ok && result.data.courseIds).toEqual(['c1', 'c2'])
  })

  it('rejects an unknown intent', () => {
    expect(errorOf(form({ intent: 'archive' }))).toBe('Invalid action.')
  })
})
```

Create `lib/__tests__/announcements/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { audienceSummary, formatAnnouncementDate } from '@/lib/announcements/format'

describe('audienceSummary', () => {
  it('names everyone', () => {
    expect(audienceSummary('EVERYONE', ['Ignored'])).toBe('Everyone')
  })

  it('lists up to two course titles', () => {
    expect(audienceSummary('COURSES', ['Marhala 1'])).toBe('Marhala 1')
    expect(audienceSummary('COURSES', ['Marhala 1', 'Marhala 2'])).toBe('Marhala 1, Marhala 2')
  })

  it('shortens longer lists', () => {
    expect(audienceSummary('COURSES', ['A', 'B', 'C', 'D'])).toBe('A, B +2 more')
  })

  it('says when a course audience has no courses left', () => {
    expect(audienceSummary('COURSES', [])).toBe('No courses')
  })
})

describe('formatAnnouncementDate', () => {
  // 17:30 UTC on the 14th is already the 15th in Manila.
  it('formats on the Manila calendar', () => {
    expect(formatAnnouncementDate(new Date('2026-09-14T17:30:00Z'))).toBe('Sep 15, 2026')
  })
})
```

Create `lib/__tests__/announcements/picker.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { groupCheckState, toggleGroup, toggleCourse } from '@/lib/announcements/picker'

const levels = ['m1', 'm2', 'm3']

describe('groupCheckState', () => {
  it('reports none, some and all', () => {
    expect(groupCheckState(levels, new Set())).toBe('none')
    expect(groupCheckState(levels, new Set(['m2']))).toBe('some')
    expect(groupCheckState(levels, new Set(levels))).toBe('all')
  })

  it('ignores selections outside the group', () => {
    expect(groupCheckState(levels, new Set(['x']))).toBe('none')
  })
})

describe('toggleGroup', () => {
  it('selects every level when the group is partly selected', () => {
    const next = toggleGroup(levels, new Set(['m1', 'x']))
    expect([...next].sort()).toEqual(['m1', 'm2', 'm3', 'x'])
  })

  it('clears every level when the group is fully selected', () => {
    const next = toggleGroup(levels, new Set([...levels, 'x']))
    expect([...next]).toEqual(['x'])
  })

  it('does not mutate the input', () => {
    const selected = new Set(['m1'])
    toggleGroup(levels, selected)
    expect([...selected]).toEqual(['m1'])
  })
})

describe('toggleCourse', () => {
  it('adds and removes one course', () => {
    expect([...toggleCourse('c1', new Set())]).toEqual(['c1'])
    expect([...toggleCourse('c1', new Set(['c1', 'c2']))]).toEqual(['c2'])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run lib/__tests__/announcements/validation.test.ts lib/__tests__/announcements/format.test.ts lib/__tests__/announcements/picker.test.ts`
Expected: FAIL, the three modules cannot be resolved.

- [ ] **Step 3: Implement**

Create `lib/announcements/limits.ts`:

```ts
// Shared by the form's maxLength attributes and the server-side schema, so
// the browser and the server enforce the same limits.
export const TITLE_MAX = 200
export const CONTENT_MAX = 5000
```

Create `lib/announcements/validation.ts`:

```ts
import { z } from 'zod'
import { CONTENT_MAX, TITLE_MAX } from './limits'

const announcementSchema = z
  .object({
    id: z.string().min(1).optional(),
    title: z
      .string()
      .trim()
      .min(1, 'Title is required.')
      .max(TITLE_MAX, 'Title must be 200 characters or fewer.'),
    content: z
      .string()
      .trim()
      .min(1, 'Content is required.')
      .max(CONTENT_MAX, 'Content must be 5,000 characters or fewer.'),
    audience: z.enum(['EVERYONE', 'COURSES'], { error: 'Please choose an audience.' }),
    courseIds: z.array(z.string().min(1)).transform((ids) => [...new Set(ids)]),
    isPinned: z.boolean(),
    removeImage: z.boolean(),
    intent: z.enum(['save', 'publish', 'unpublish'], { error: 'Invalid action.' }),
  })
  .refine((d) => d.audience === 'EVERYONE' || d.courseIds.length > 0, {
    message: 'Choose at least one course.',
    path: ['courseIds'],
  })

export type AnnouncementInput = z.output<typeof announcementSchema>

export function parseAnnouncementForm(
  formData: FormData,
): { ok: true; data: AnnouncementInput } | { ok: false; error: string } {
  const id = formData.get('id')
  const result = announcementSchema.safeParse({
    id: typeof id === 'string' && id !== '' ? id : undefined,
    title: formData.get('title') ?? '',
    content: formData.get('content') ?? '',
    audience: formData.get('audience'),
    courseIds: formData.getAll('courseIds').filter((v): v is string => typeof v === 'string'),
    isPinned: formData.get('isPinned') === 'on',
    removeImage: formData.get('removeImage') === 'on',
    intent: formData.get('intent'),
  })
  if (!result.success) {
    return { ok: false, error: result.error.issues[0]?.message ?? 'Validation failed.' }
  }
  return { ok: true, data: result.data }
}
```

Create `lib/announcements/format.ts`:

```ts
import type { AnnouncementAudience } from '@prisma/client'

// The server runs in UTC; announcements are dated on the academy's calendar.
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export function formatAnnouncementDate(date: Date): string {
  return dateFormatter.format(date)
}

const SHOWN_TITLES = 2

export function audienceSummary(audience: AnnouncementAudience, courseTitles: string[]): string {
  if (audience === 'EVERYONE') return 'Everyone'
  if (courseTitles.length === 0) return 'No courses'
  const shown = courseTitles.slice(0, SHOWN_TITLES).join(', ')
  const rest = courseTitles.length - SHOWN_TITLES
  return rest > 0 ? `${shown} +${rest} more` : shown
}
```

Create `lib/announcements/picker.ts`:

```ts
// Selection rules for the audience picker's group checkboxes, kept pure so
// they can be tested without rendering the form.

export type GroupCheckState = 'all' | 'some' | 'none'

export function groupCheckState(
  levelIds: readonly string[],
  selected: ReadonlySet<string>,
): GroupCheckState {
  const count = levelIds.filter((id) => selected.has(id)).length
  if (count === 0) return 'none'
  return count === levelIds.length ? 'all' : 'some'
}

// A fully selected group clears; anything less selects every level.
export function toggleGroup(levelIds: readonly string[], selected: ReadonlySet<string>): Set<string> {
  const next = new Set(selected)
  const clear = groupCheckState(levelIds, selected) === 'all'
  for (const id of levelIds) {
    if (clear) next.delete(id)
    else next.add(id)
  }
  return next
}

export function toggleCourse(id: string, selected: ReadonlySet<string>): Set<string> {
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run lib/__tests__/announcements/validation.test.ts lib/__tests__/announcements/format.test.ts lib/__tests__/announcements/picker.test.ts`
Expected: PASS, 21 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/announcements/limits.ts lib/announcements/validation.ts lib/announcements/format.ts lib/announcements/picker.ts lib/__tests__/announcements/validation.test.ts lib/__tests__/announcements/format.test.ts lib/__tests__/announcements/picker.test.ts
git commit -m "feat(announcements): add form validation, formatting and picker helpers"
```

---

### Task 4: Queries and the dashboard hand-off

**Files:**
- Create: `lib/announcements/queries.ts`
- Modify: `lib/student/queries.ts` (imports, `DashboardAnnouncement` near line 26, the `db.announcement.findMany` call near line 78)
- Test: `lib/__tests__/announcements/queries.test.ts`, `lib/__tests__/announcements/dashboard.test.ts`

**Interfaces:**
- Consumes: `ACTIVE_COURSE`, `ACTIVE_ENROLLMENT`, Prisma types from Task 1.
- Produces:
  - `type StudentAnnouncement = { id: string; title: string; content: string; imageUrl: string | null; isPinned: boolean; publishedAt: Date | null }`
  - `getStudentAnnouncements(userId: string, options?: { take?: number }): Promise<StudentAnnouncement[]>`
  - `type AdminAnnouncementRow = { id: string; title: string; audience: AnnouncementAudience; courseTitles: string[]; isPublished: boolean; isPinned: boolean; publishedAt: Date | null }`
  - `getAdminAnnouncements(): Promise<AdminAnnouncementRow[]>`
  - `type AnnouncementForEdit = { id: string; title: string; content: string; imageUrl: string | null; audience: AnnouncementAudience; isPublished: boolean; isPinned: boolean; publishedAt: Date | null; courseIds: string[] }`
  - `getAnnouncementForEdit(id: string): Promise<AnnouncementForEdit | null>`
  - `type AnnouncementCourseOption = { id: string; title: string; groupName: string | null; level: number | null; archived: boolean }`
  - `getAnnouncementCourseOptions(attachedCourseIds?: string[]): Promise<AnnouncementCourseOption[]>`
  - In `lib/student/queries.ts`: `DASHBOARD_ANNOUNCEMENTS = 3` and `type DashboardAnnouncement = StudentAnnouncement`.

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/announcements/queries.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    announcement: { findMany: vi.fn(), findUnique: vi.fn() },
    course: { findMany: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import {
  getStudentAnnouncements,
  getAdminAnnouncements,
  getAnnouncementForEdit,
  getAnnouncementCourseOptions,
} from '@/lib/announcements/queries'

describe('announcement queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.announcement.findMany).mockResolvedValue([] as never)
    vi.mocked(db.course.findMany).mockResolvedValue([] as never)
  })

  describe('getStudentAnnouncements', () => {
    it('shows published announcements for everyone or an active enrollment in an active course', async () => {
      await getStudentAnnouncements('u1')
      const arg = vi.mocked(db.announcement.findMany).mock.calls[0][0]!
      expect(arg.where).toEqual({
        isPublished: true,
        OR: [
          { audience: 'EVERYONE' },
          {
            courses: {
              some: {
                course: {
                  archivedAt: null,
                  enrollments: { some: { userId: 'u1', removedAt: null } },
                },
              },
            },
          },
        ],
      })
      expect(arg.orderBy).toEqual([{ isPinned: 'desc' }, { publishedAt: 'desc' }])
      expect(arg.take).toBeUndefined()
    })

    it('passes take through', async () => {
      await getStudentAnnouncements('u1', { take: 4 })
      expect(vi.mocked(db.announcement.findMany).mock.calls[0][0]!.take).toBe(4)
    })
  })

  describe('getAdminAnnouncements', () => {
    it('lists pinned first, then most recently edited, with sorted course titles', async () => {
      vi.mocked(db.announcement.findMany).mockResolvedValue([
        {
          id: 'a1',
          title: 'T',
          audience: 'COURSES',
          isPublished: true,
          isPinned: false,
          publishedAt: null,
          courses: [{ course: { title: 'Marhala 2' } }, { course: { title: 'Marhala 1' } }],
        },
      ] as never)

      const rows = await getAdminAnnouncements()

      const arg = vi.mocked(db.announcement.findMany).mock.calls[0][0]!
      expect(arg.where).toBeUndefined()
      expect(arg.orderBy).toEqual([{ isPinned: 'desc' }, { updatedAt: 'desc' }])
      expect(rows).toEqual([
        {
          id: 'a1',
          title: 'T',
          audience: 'COURSES',
          isPublished: true,
          isPinned: false,
          publishedAt: null,
          courseTitles: ['Marhala 1', 'Marhala 2'],
        },
      ])
    })
  })

  describe('getAnnouncementForEdit', () => {
    it('returns null when missing', async () => {
      vi.mocked(db.announcement.findUnique).mockResolvedValue(null as never)
      expect(await getAnnouncementForEdit('nope')).toBeNull()
    })

    it('flattens the attached course ids', async () => {
      vi.mocked(db.announcement.findUnique).mockResolvedValue({
        id: 'a1',
        title: 'T',
        content: 'C',
        imageUrl: null,
        audience: 'COURSES',
        isPublished: false,
        isPinned: true,
        publishedAt: null,
        courses: [{ courseId: 'c1' }, { courseId: 'c2' }],
      } as never)

      expect(await getAnnouncementForEdit('a1')).toMatchObject({ id: 'a1', courseIds: ['c1', 'c2'] })
    })
  })

  describe('getAnnouncementCourseOptions', () => {
    it('offers active courses plus archived ones already attached', async () => {
      vi.mocked(db.course.findMany).mockResolvedValue([
        { id: 'c1', title: 'Marhala 1', groupName: 'Marhala', level: 1, archivedAt: null },
        { id: 'c9', title: 'Old', groupName: null, level: null, archivedAt: new Date() },
      ] as never)

      const options = await getAnnouncementCourseOptions(['c9'])

      const arg = vi.mocked(db.course.findMany).mock.calls[0][0]!
      expect(arg.where).toEqual({ OR: [{ archivedAt: null }, { id: { in: ['c9'] } }] })
      expect(options).toEqual([
        { id: 'c1', title: 'Marhala 1', groupName: 'Marhala', level: 1, archived: false },
        { id: 'c9', title: 'Old', groupName: null, level: null, archived: true },
      ])
    })
  })
})
```

Create `lib/__tests__/announcements/dashboard.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    enrollment: { findMany: vi.fn() },
    purchase: { findMany: vi.fn() },
    lessonCompletion: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/subjects/access', () => ({ getUserGender: vi.fn() }))
vi.mock('@/lib/announcements/queries', () => ({ getStudentAnnouncements: vi.fn() }))

import { db } from '@/lib/db'
import { getStudentAnnouncements } from '@/lib/announcements/queries'
import { getStudentDashboard, DASHBOARD_ANNOUNCEMENTS } from '@/lib/student/queries'

describe('getStudentDashboard announcements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.enrollment.findMany).mockResolvedValue([] as never)
    vi.mocked(db.purchase.findMany).mockResolvedValue([] as never)
  })

  // One extra row tells the page whether to offer "View all".
  it('asks for one more announcement than the dashboard shows', async () => {
    const announcement = {
      id: 'a1',
      title: 'T',
      content: 'C',
      imageUrl: null,
      isPinned: false,
      publishedAt: new Date(),
    }
    vi.mocked(getStudentAnnouncements).mockResolvedValue([announcement])

    const dashboard = await getStudentDashboard('u1')

    expect(getStudentAnnouncements).toHaveBeenCalledWith('u1', { take: DASHBOARD_ANNOUNCEMENTS + 1 })
    expect(dashboard.announcements).toEqual([announcement])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run lib/__tests__/announcements/queries.test.ts lib/__tests__/announcements/dashboard.test.ts`
Expected: FAIL, `@/lib/announcements/queries` cannot be resolved and `DASHBOARD_ANNOUNCEMENTS` is not exported.

- [ ] **Step 3: Implement the queries**

Create `lib/announcements/queries.ts`:

```ts
import type { AnnouncementAudience, Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ACTIVE_COURSE } from '@/lib/courses/archive'
import { ACTIVE_ENROLLMENT } from '@/lib/enrollments/active'

// ─── Student ─────────────────────────────────────────────────────────────────

export type StudentAnnouncement = {
  id: string
  title: string
  content: string
  imageUrl: string | null
  isPinned: boolean
  publishedAt: Date | null
}

// A pending purchase has no enrollment yet, so that student sees only
// announcements for everyone. A removed enrollment or an archived course stops
// a course announcement reaching the student.
function studentAnnouncementWhere(userId: string): Prisma.AnnouncementWhereInput {
  return {
    isPublished: true,
    OR: [
      { audience: 'EVERYONE' },
      {
        courses: {
          some: {
            course: {
              ...ACTIVE_COURSE,
              enrollments: { some: { userId, ...ACTIVE_ENROLLMENT } },
            },
          },
        },
      },
    ],
  }
}

export async function getStudentAnnouncements(
  userId: string,
  options: { take?: number } = {},
): Promise<StudentAnnouncement[]> {
  return db.announcement.findMany({
    where: studentAnnouncementWhere(userId),
    orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
    take: options.take,
    select: { id: true, title: true, content: true, imageUrl: true, isPinned: true, publishedAt: true },
  })
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export type AdminAnnouncementRow = {
  id: string
  title: string
  audience: AnnouncementAudience
  courseTitles: string[]
  isPublished: boolean
  isPinned: boolean
  publishedAt: Date | null
}

export async function getAdminAnnouncements(): Promise<AdminAnnouncementRow[]> {
  const rows = await db.announcement.findMany({
    orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      audience: true,
      isPublished: true,
      isPinned: true,
      publishedAt: true,
      courses: { select: { course: { select: { title: true } } } },
    },
  })
  return rows.map(({ courses, ...row }) => ({
    ...row,
    courseTitles: courses.map((c) => c.course.title).sort((a, b) => a.localeCompare(b)),
  }))
}

export type AnnouncementForEdit = {
  id: string
  title: string
  content: string
  imageUrl: string | null
  audience: AnnouncementAudience
  isPublished: boolean
  isPinned: boolean
  publishedAt: Date | null
  courseIds: string[]
}

export async function getAnnouncementForEdit(id: string): Promise<AnnouncementForEdit | null> {
  const row = await db.announcement.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      content: true,
      imageUrl: true,
      audience: true,
      isPublished: true,
      isPinned: true,
      publishedAt: true,
      courses: { select: { courseId: true } },
    },
  })
  if (!row) return null
  const { courses, ...rest } = row
  return { ...rest, courseIds: courses.map((c) => c.courseId) }
}

export type AnnouncementCourseOption = {
  id: string
  title: string
  groupName: string | null
  level: number | null
  archived: boolean
}

// Archived courses are not offered, except ones this announcement already
// targets, so the admin can see them and untick them.
export async function getAnnouncementCourseOptions(
  attachedCourseIds: string[] = [],
): Promise<AnnouncementCourseOption[]> {
  const courses = await db.course.findMany({
    where: { OR: [{ ...ACTIVE_COURSE }, { id: { in: attachedCourseIds } }] },
    orderBy: { title: 'asc' },
    select: { id: true, title: true, groupName: true, level: true, archivedAt: true },
  })
  return courses.map(({ archivedAt, ...course }) => ({ ...course, archived: archivedAt !== null }))
}
```

- [ ] **Step 4: Hand the dashboard over**

In `lib/student/queries.ts`, add to the imports:

```ts
import { getStudentAnnouncements, type StudentAnnouncement } from '@/lib/announcements/queries'
```

Replace the `DashboardAnnouncement` type block with:

```ts
// The dashboard shows this many; it fetches one more to know whether to offer
// "View all".
export const DASHBOARD_ANNOUNCEMENTS = 3

export type DashboardAnnouncement = StudentAnnouncement
```

Replace the `db.announcement.findMany({ ... })` entry inside the `Promise.all` in `getStudentDashboard` with:

```ts
    getStudentAnnouncements(userId, { take: DASHBOARD_ANNOUNCEMENTS + 1 }),
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run lib/__tests__/announcements lib/__tests__/enrollments/blackout.test.ts`
Expected: PASS.
`blackout.test.ts` still passes because `getStudentAnnouncements` calls its mocked `db.announcement.findMany`.

- [ ] **Step 6: Type-check**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no errors.
The dashboard page still compiles because it only reads `id`, `title` and `content`.

- [ ] **Step 7: Commit**

```bash
git add lib/announcements/queries.ts lib/student/queries.ts lib/__tests__/announcements/queries.test.ts lib/__tests__/announcements/dashboard.test.ts
git commit -m "feat(announcements): add queries and target dashboard announcements per student"
```

---

### Task 5: Save action (content, audience, publishing)

**Files:**
- Create: `lib/announcements/actions.ts`
- Test: `lib/__tests__/announcements/actions.test.ts`

**Interfaces:**
- Consumes: `parseAnnouncementForm` (Task 3).
- Produces:
  - `type AnnouncementActionState = { error: string | null; message?: string }`
  - `saveAnnouncementAction(prev: AnnouncementActionState, formData: FormData): Promise<AnnouncementActionState>` - on create, redirects to `/admin/announcements/{id}?created=1`; on update returns `message` `'Saved.'`, `'Published.'` or `'Unpublished.'`.

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/announcements/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    announcement: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    course: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/auth/session', () => ({ getSession: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))
vi.mock('@/lib/announcements/storage', () => ({
  uploadAnnouncementImage: vi.fn(),
  removeAnnouncementImage: vi.fn(),
}))

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { saveAnnouncementAction } from '@/lib/announcements/actions'

const initial = { error: null }

function form(fields: Record<string, string | string[] | File>): FormData {
  const fd = new FormData()
  const base = { title: 'Eid break', content: 'Classes resume Monday.', audience: 'EVERYONE', intent: 'save' }
  for (const [key, value] of Object.entries({ ...base, ...fields })) {
    if (Array.isArray(value)) value.forEach((v) => fd.append(key, v))
    else fd.set(key, value)
  }
  return fd
}

function existing(overrides: Record<string, unknown> = {}) {
  return { imageUrl: null, publishedAt: null, courses: [], ...overrides }
}

function createData() {
  return vi.mocked(db.announcement.create).mock.calls[0][0].data as Record<string, unknown>
}

function updateData() {
  return vi.mocked(db.announcement.update).mock.calls[0][0].data as Record<string, unknown>
}

describe('saveAnnouncementAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue({ userId: 'admin1', role: 'ADMIN' } as never)
    vi.mocked(db.announcement.create).mockResolvedValue({ id: 'a1' } as never)
    vi.mocked(db.announcement.update).mockResolvedValue({} as never)
    vi.mocked(db.announcement.findUnique).mockResolvedValue(existing() as never)
    vi.mocked(db.course.findMany).mockResolvedValue([] as never)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('access', () => {
    it('rejects a missing session', async () => {
      vi.mocked(getSession).mockResolvedValue(null as never)
      expect(await saveAnnouncementAction(initial, form({}))).toEqual({ error: 'Unauthorized' })
      expect(db.announcement.create).not.toHaveBeenCalled()
    })

    it('rejects a non-admin', async () => {
      vi.mocked(getSession).mockResolvedValue({ userId: 't1', role: 'TEACHER' } as never)
      expect(await saveAnnouncementAction(initial, form({}))).toEqual({ error: 'Forbidden' })
      expect(db.announcement.create).not.toHaveBeenCalled()
    })

    it('allows a super admin', async () => {
      vi.mocked(getSession).mockResolvedValue({ userId: 's1', role: 'SUPER_ADMIN' } as never)
      await expect(saveAnnouncementAction(initial, form({}))).rejects.toThrow('NEXT_REDIRECT')
      expect(db.announcement.create).toHaveBeenCalled()
    })
  })

  it('returns the validation error without writing', async () => {
    expect(await saveAnnouncementAction(initial, form({ title: '' }))).toEqual({
      error: 'Title is required.',
    })
    expect(db.announcement.create).not.toHaveBeenCalled()
  })

  describe('create', () => {
    it('saves a draft without publishing and redirects to the edit page', async () => {
      await expect(saveAnnouncementAction(initial, form({ isPinned: 'on' }))).rejects.toThrow(
        'NEXT_REDIRECT',
      )
      const data = createData()
      expect(data).toMatchObject({
        title: 'Eid break',
        content: 'Classes resume Monday.',
        audience: 'EVERYONE',
        isPinned: true,
        courses: { create: [] },
      })
      expect(data).not.toHaveProperty('isPublished')
      expect(data).not.toHaveProperty('publishedAt')
      expect(redirect).toHaveBeenCalledWith('/admin/announcements/a1?created=1')
      expect(revalidatePath).toHaveBeenCalledWith('/student/dashboard')
      expect(revalidatePath).toHaveBeenCalledWith('/student/announcements')
    })

    it('publishes with a publish date', async () => {
      await expect(saveAnnouncementAction(initial, form({ intent: 'publish' }))).rejects.toThrow(
        'NEXT_REDIRECT',
      )
      const data = createData()
      expect(data.isPublished).toBe(true)
      expect(data.publishedAt).toBeInstanceOf(Date)
    })

    it('links the selected courses', async () => {
      vi.mocked(db.course.findMany).mockResolvedValue([
        { id: 'c1', archivedAt: null },
        { id: 'c2', archivedAt: null },
      ] as never)
      await expect(
        saveAnnouncementAction(initial, form({ audience: 'COURSES', courseIds: ['c1', 'c2'] })),
      ).rejects.toThrow('NEXT_REDIRECT')
      expect(createData().courses).toEqual({ create: [{ courseId: 'c1' }, { courseId: 'c2' }] })
    })

    it('rejects an unknown course', async () => {
      vi.mocked(db.course.findMany).mockResolvedValue([] as never)
      expect(
        await saveAnnouncementAction(initial, form({ audience: 'COURSES', courseIds: ['c1'] })),
      ).toEqual({ error: 'One or more selected courses are no longer available.' })
      expect(db.announcement.create).not.toHaveBeenCalled()
    })

    it('rejects a newly selected archived course', async () => {
      vi.mocked(db.course.findMany).mockResolvedValue([{ id: 'c1', archivedAt: new Date() }] as never)
      expect(
        await saveAnnouncementAction(initial, form({ audience: 'COURSES', courseIds: ['c1'] })),
      ).toEqual({ error: 'One or more selected courses are no longer available.' })
    })

    it('returns a friendly error when the database write fails', async () => {
      vi.mocked(db.announcement.create).mockRejectedValue(new Error('db down'))
      expect(await saveAnnouncementAction(initial, form({}))).toEqual({
        error: 'A database error occurred. Please try again.',
      })
    })
  })

  describe('update', () => {
    it('fails when the announcement no longer exists', async () => {
      vi.mocked(db.announcement.findUnique).mockResolvedValue(null as never)
      expect(await saveAnnouncementAction(initial, form({ id: 'gone' }))).toEqual({
        error: 'Announcement not found.',
      })
      expect(db.announcement.update).not.toHaveBeenCalled()
    })

    it('replaces the course list in the same write', async () => {
      vi.mocked(db.course.findMany).mockResolvedValue([{ id: 'c2', archivedAt: null }] as never)
      const result = await saveAnnouncementAction(
        initial,
        form({ id: 'a1', audience: 'COURSES', courseIds: ['c2'] }),
      )
      expect(result).toEqual({ error: null, message: 'Saved.' })
      expect(vi.mocked(db.announcement.update).mock.calls[0][0].where).toEqual({ id: 'a1' })
      expect(updateData().courses).toEqual({ deleteMany: {}, create: [{ courseId: 'c2' }] })
      expect(redirect).not.toHaveBeenCalled()
    })

    it('clears the courses when switching to everyone', async () => {
      vi.mocked(db.announcement.findUnique).mockResolvedValue(
        existing({ courses: [{ courseId: 'c1' }] }) as never,
      )
      await saveAnnouncementAction(initial, form({ id: 'a1', audience: 'EVERYONE', courseIds: ['c1'] }))
      expect(updateData().courses).toEqual({ deleteMany: {}, create: [] })
      expect(db.course.findMany).not.toHaveBeenCalled()
    })

    it('keeps an archived course that was already attached', async () => {
      vi.mocked(db.announcement.findUnique).mockResolvedValue(
        existing({ courses: [{ courseId: 'c1' }] }) as never,
      )
      vi.mocked(db.course.findMany).mockResolvedValue([{ id: 'c1', archivedAt: new Date() }] as never)
      const result = await saveAnnouncementAction(
        initial,
        form({ id: 'a1', audience: 'COURSES', courseIds: ['c1'] }),
      )
      expect(result).toEqual({ error: null, message: 'Saved.' })
    })

    it('saving leaves the published state alone', async () => {
      await saveAnnouncementAction(initial, form({ id: 'a1' }))
      expect(updateData()).not.toHaveProperty('isPublished')
      expect(updateData()).not.toHaveProperty('publishedAt')
    })

    it('keeps the first publish date when republishing', async () => {
      const first = new Date('2026-09-01T00:00:00Z')
      vi.mocked(db.announcement.findUnique).mockResolvedValue(existing({ publishedAt: first }) as never)
      const result = await saveAnnouncementAction(initial, form({ id: 'a1', intent: 'publish' }))
      expect(result).toEqual({ error: null, message: 'Published.' })
      expect(updateData()).toMatchObject({ isPublished: true, publishedAt: first })
    })

    it('unpublishes without touching the publish date', async () => {
      const result = await saveAnnouncementAction(initial, form({ id: 'a1', intent: 'unpublish' }))
      expect(result).toEqual({ error: null, message: 'Unpublished.' })
      expect(updateData().isPublished).toBe(false)
      expect(updateData()).not.toHaveProperty('publishedAt')
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run lib/__tests__/announcements/actions.test.ts`
Expected: FAIL, `@/lib/announcements/actions` cannot be resolved.

- [ ] **Step 3: Implement**

Create `lib/announcements/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { parseAnnouncementForm } from './validation'

export type AnnouncementActionState = { error: string | null; message?: string }

async function denyUnlessAdmin(): Promise<string | null> {
  const session = await getSession()
  if (!session) return 'Unauthorized'
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return 'Forbidden'
  return null
}

function revalidateAnnouncements(id?: string) {
  revalidatePath('/admin/announcements')
  if (id) revalidatePath(`/admin/announcements/${id}`)
  revalidatePath('/student/dashboard')
  revalidatePath('/student/announcements')
}

const SUCCESS_MESSAGE = { save: 'Saved.', publish: 'Published.', unpublish: 'Unpublished.' } as const

export async function saveAnnouncementAction(
  _prev: AnnouncementActionState,
  formData: FormData,
): Promise<AnnouncementActionState> {
  const denied = await denyUnlessAdmin()
  if (denied) return { error: denied }

  const parsed = parseAnnouncementForm(formData)
  if (!parsed.ok) return { error: parsed.error }
  const input = parsed.data

  const existing = input.id
    ? await db.announcement.findUnique({
        where: { id: input.id },
        select: { imageUrl: true, publishedAt: true, courses: { select: { courseId: true } } },
      })
    : null
  if (input.id && !existing) return { error: 'Announcement not found.' }

  const courseIds = input.audience === 'COURSES' ? input.courseIds : []
  if (courseIds.length > 0) {
    // An archived course may stay only if it was already attached; it cannot
    // be newly targeted.
    const attached = new Set(existing?.courses.map((c) => c.courseId))
    const found = await db.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, archivedAt: true },
    })
    const usable = found.filter((c) => c.archivedAt === null || attached.has(c.id))
    if (usable.length !== courseIds.length) {
      return { error: 'One or more selected courses are no longer available.' }
    }
  }

  const data = {
    title: input.title,
    content: input.content,
    audience: input.audience,
    isPinned: input.isPinned,
    ...(input.intent === 'publish' && {
      isPublished: true,
      publishedAt: existing?.publishedAt ?? new Date(),
    }),
    ...(input.intent === 'unpublish' && { isPublished: false }),
  }
  const courseRows = courseIds.map((courseId) => ({ courseId }))

  let id: string
  try {
    if (input.id) {
      // Nested writes run in one transaction, so the course list is never
      // left half replaced.
      await db.announcement.update({
        where: { id: input.id },
        data: { ...data, courses: { deleteMany: {}, create: courseRows } },
      })
      id = input.id
    } else {
      const created = await db.announcement.create({
        data: { ...data, courses: { create: courseRows } },
        select: { id: true },
      })
      id = created.id
    }
  } catch (err) {
    console.error('[saveAnnouncement] db', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  revalidateAnnouncements(id)
  if (!input.id) redirect(`/admin/announcements/${id}?created=1`)
  return { error: null, message: SUCCESS_MESSAGE[input.intent] }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run lib/__tests__/announcements/actions.test.ts`
Expected: PASS, 17 tests.

- [ ] **Step 5: Type-check and commit**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no errors.

```bash
git add lib/announcements/actions.ts lib/__tests__/announcements/actions.test.ts
git commit -m "feat(announcements): add the save action with course targeting and publishing"
```

---

### Task 6: Images in the save action, and the delete action

**Files:**
- Modify: `lib/announcements/actions.ts`
- Test: `lib/__tests__/announcements/actions.test.ts`

**Interfaces:**
- Consumes: `validateImageUpload` from `@/lib/uploads/image`; `uploadAnnouncementImage`, `removeAnnouncementImage` (Task 2).
- Produces: `deleteAnnouncementAction(prev: AnnouncementActionState, formData: FormData): Promise<AnnouncementActionState>` - reads `id`, redirects to `/admin/announcements` on success.
The form field for the file is `image`; the checkbox is `removeImage`.

- [ ] **Step 1: Write the failing tests**

In `lib/__tests__/announcements/actions.test.ts`, change the actions import and add the storage import:

```ts
import { saveAnnouncementAction, deleteAnnouncementAction } from '@/lib/announcements/actions'
import { uploadAnnouncementImage, removeAnnouncementImage } from '@/lib/announcements/storage'
```

Append at the end of the file:

```ts
const BUCKET_URL = 'https://abc.supabase.co/storage/v1/object/public/course-images'
const OLD_URL = `${BUCKET_URL}/announcements/old.png`
const NEW_URL = `${BUCKET_URL}/announcements/new.png`

function png(): File {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
  return new File([bytes], 'poster.png', { type: 'image/png' })
}

describe('saveAnnouncementAction images', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue({ userId: 'admin1', role: 'ADMIN' } as never)
    vi.mocked(db.announcement.create).mockResolvedValue({ id: 'a1' } as never)
    vi.mocked(db.announcement.update).mockResolvedValue({} as never)
    vi.mocked(db.announcement.findUnique).mockResolvedValue(existing({ imageUrl: OLD_URL }) as never)
    vi.mocked(uploadAnnouncementImage).mockResolvedValue(NEW_URL)
    vi.mocked(removeAnnouncementImage).mockResolvedValue(undefined)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects a file that is not an image before uploading', async () => {
    const text = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    expect(await saveAnnouncementAction(initial, form({ image: text }))).toEqual({
      error: 'Only JPG, PNG, and WEBP images are accepted.',
    })
    expect(uploadAnnouncementImage).not.toHaveBeenCalled()
    expect(db.announcement.create).not.toHaveBeenCalled()
  })

  it('stores the uploaded image URL on create', async () => {
    await expect(saveAnnouncementAction(initial, form({ image: png() }))).rejects.toThrow(
      'NEXT_REDIRECT',
    )
    expect(uploadAnnouncementImage).toHaveBeenCalledWith(
      expect.objectContaining({ ext: 'png', contentType: 'image/png' }),
    )
    expect(createData().imageUrl).toBe(NEW_URL)
  })

  it('reports an upload failure without writing', async () => {
    vi.mocked(uploadAnnouncementImage).mockRejectedValue(new Error('storage down'))
    expect(await saveAnnouncementAction(initial, form({ image: png() }))).toEqual({
      error: 'Failed to upload image. Please try again.',
    })
    expect(db.announcement.create).not.toHaveBeenCalled()
  })

  it('removes the just-uploaded file when the database write fails, and keeps the old one', async () => {
    vi.mocked(db.announcement.update).mockRejectedValue(new Error('db down'))
    expect(await saveAnnouncementAction(initial, form({ id: 'a1', image: png() }))).toEqual({
      error: 'A database error occurred. Please try again.',
    })
    expect(removeAnnouncementImage).toHaveBeenCalledTimes(1)
    expect(removeAnnouncementImage).toHaveBeenCalledWith(NEW_URL)
  })

  it('replaces the image and removes the old file only after the write', async () => {
    const result = await saveAnnouncementAction(initial, form({ id: 'a1', image: png() }))
    expect(result).toEqual({ error: null, message: 'Saved.' })
    expect(updateData().imageUrl).toBe(NEW_URL)
    expect(removeAnnouncementImage).toHaveBeenCalledWith(OLD_URL)
    expect(vi.mocked(db.announcement.update).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(removeAnnouncementImage).mock.invocationCallOrder[0],
    )
  })

  it('removes the image when asked', async () => {
    await saveAnnouncementAction(initial, form({ id: 'a1', removeImage: 'on' }))
    expect(updateData().imageUrl).toBeNull()
    expect(removeAnnouncementImage).toHaveBeenCalledWith(OLD_URL)
  })

  it('keeps the current image when no file is chosen', async () => {
    await saveAnnouncementAction(initial, form({ id: 'a1' }))
    expect(updateData().imageUrl).toBe(OLD_URL)
    expect(uploadAnnouncementImage).not.toHaveBeenCalled()
    expect(removeAnnouncementImage).not.toHaveBeenCalled()
  })
})

describe('deleteAnnouncementAction', () => {
  function deleteForm(id = 'a1') {
    const fd = new FormData()
    fd.set('id', id)
    return fd
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue({ userId: 'admin1', role: 'ADMIN' } as never)
    vi.mocked(db.announcement.findUnique).mockResolvedValue({ imageUrl: OLD_URL } as never)
    vi.mocked(db.announcement.delete).mockResolvedValue({} as never)
    vi.mocked(removeAnnouncementImage).mockResolvedValue(undefined)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects a non-admin', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 's1', role: 'STUDENT' } as never)
    expect(await deleteAnnouncementAction(initial, deleteForm())).toEqual({ error: 'Forbidden' })
    expect(db.announcement.delete).not.toHaveBeenCalled()
  })

  it('reports a missing announcement', async () => {
    vi.mocked(db.announcement.findUnique).mockResolvedValue(null as never)
    expect(await deleteAnnouncementAction(initial, deleteForm('gone'))).toEqual({
      error: 'Announcement not found.',
    })
  })

  it('deletes the row, then its image, then returns to the list', async () => {
    await expect(deleteAnnouncementAction(initial, deleteForm())).rejects.toThrow('NEXT_REDIRECT')
    expect(db.announcement.delete).toHaveBeenCalledWith({ where: { id: 'a1' } })
    expect(removeAnnouncementImage).toHaveBeenCalledWith(OLD_URL)
    expect(vi.mocked(db.announcement.delete).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(removeAnnouncementImage).mock.invocationCallOrder[0],
    )
    expect(redirect).toHaveBeenCalledWith('/admin/announcements')
  })

  it('skips storage when there is no image', async () => {
    vi.mocked(db.announcement.findUnique).mockResolvedValue({ imageUrl: null } as never)
    await expect(deleteAnnouncementAction(initial, deleteForm())).rejects.toThrow('NEXT_REDIRECT')
    expect(removeAnnouncementImage).not.toHaveBeenCalled()
  })

  it('keeps the image when the delete fails', async () => {
    vi.mocked(db.announcement.delete).mockRejectedValue(new Error('db down'))
    expect(await deleteAnnouncementAction(initial, deleteForm())).toEqual({
      error: 'A database error occurred. Please try again.',
    })
    expect(removeAnnouncementImage).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run lib/__tests__/announcements/actions.test.ts`
Expected: FAIL, `deleteAnnouncementAction` is not exported and the image tests fail (no upload happens, `imageUrl` is missing from the written data).

- [ ] **Step 3: Implement**

In `lib/announcements/actions.ts`, add to the imports:

```ts
import { validateImageUpload } from '@/lib/uploads/image'
import { removeAnnouncementImage, uploadAnnouncementImage } from './storage'
```

Replace the whole `saveAnnouncementAction` function with:

```ts
export async function saveAnnouncementAction(
  _prev: AnnouncementActionState,
  formData: FormData,
): Promise<AnnouncementActionState> {
  const denied = await denyUnlessAdmin()
  if (denied) return { error: denied }

  const parsed = parseAnnouncementForm(formData)
  if (!parsed.ok) return { error: parsed.error }
  const input = parsed.data

  const file = formData.get('image')
  const hasFile = file instanceof File && file.size > 0
  const image = hasFile ? await validateImageUpload(file) : null
  if (image && !image.ok) return { error: image.error }

  const existing = input.id
    ? await db.announcement.findUnique({
        where: { id: input.id },
        select: { imageUrl: true, publishedAt: true, courses: { select: { courseId: true } } },
      })
    : null
  if (input.id && !existing) return { error: 'Announcement not found.' }

  const courseIds = input.audience === 'COURSES' ? input.courseIds : []
  if (courseIds.length > 0) {
    // An archived course may stay only if it was already attached; it cannot
    // be newly targeted.
    const attached = new Set(existing?.courses.map((c) => c.courseId))
    const found = await db.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, archivedAt: true },
    })
    const usable = found.filter((c) => c.archivedAt === null || attached.has(c.id))
    if (usable.length !== courseIds.length) {
      return { error: 'One or more selected courses are no longer available.' }
    }
  }

  // Upload before writing, so the row never points at a file that does not
  // exist. If the write then fails, the new file is removed again.
  let uploadedUrl: string | null = null
  if (image?.ok) {
    try {
      uploadedUrl = await uploadAnnouncementImage(image)
    } catch (err) {
      console.error('[saveAnnouncement] upload', err)
      return { error: 'Failed to upload image. Please try again.' }
    }
  }

  const oldImageUrl = existing?.imageUrl ?? null
  const imageUrl = uploadedUrl ?? (input.removeImage ? null : oldImageUrl)

  const data = {
    title: input.title,
    content: input.content,
    audience: input.audience,
    isPinned: input.isPinned,
    imageUrl,
    ...(input.intent === 'publish' && {
      isPublished: true,
      publishedAt: existing?.publishedAt ?? new Date(),
    }),
    ...(input.intent === 'unpublish' && { isPublished: false }),
  }
  const courseRows = courseIds.map((courseId) => ({ courseId }))

  let id: string
  try {
    if (input.id) {
      // Nested writes run in one transaction, so the course list is never
      // left half replaced.
      await db.announcement.update({
        where: { id: input.id },
        data: { ...data, courses: { deleteMany: {}, create: courseRows } },
      })
      id = input.id
    } else {
      const created = await db.announcement.create({
        data: { ...data, courses: { create: courseRows } },
        select: { id: true },
      })
      id = created.id
    }
  } catch (err) {
    console.error('[saveAnnouncement] db', err)
    if (uploadedUrl) await removeAnnouncementImage(uploadedUrl)
    return { error: 'A database error occurred. Please try again.' }
  }

  // Only now is the old file unreferenced.
  if (oldImageUrl && oldImageUrl !== imageUrl) await removeAnnouncementImage(oldImageUrl)

  revalidateAnnouncements(id)
  if (!input.id) redirect(`/admin/announcements/${id}?created=1`)
  return { error: null, message: SUCCESS_MESSAGE[input.intent] }
}
```

Append the delete action:

```ts
export async function deleteAnnouncementAction(
  _prev: AnnouncementActionState,
  formData: FormData,
): Promise<AnnouncementActionState> {
  const denied = await denyUnlessAdmin()
  if (denied) return { error: denied }

  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return { error: 'Invalid announcement ID.' }

  const announcement = await db.announcement.findUnique({
    where: { id },
    select: { imageUrl: true },
  })
  if (!announcement) return { error: 'Announcement not found.' }

  try {
    // Course links cascade with the row.
    await db.announcement.delete({ where: { id } })
  } catch (err) {
    console.error('[deleteAnnouncement] db', err)
    return { error: 'A database error occurred. Please try again.' }
  }

  if (announcement.imageUrl) await removeAnnouncementImage(announcement.imageUrl)

  revalidateAnnouncements()
  redirect('/admin/announcements')
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run lib/__tests__/announcements/actions.test.ts`
Expected: PASS, 29 tests.

- [ ] **Step 5: Type-check and commit**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no errors.

```bash
git add lib/announcements/actions.ts lib/__tests__/announcements/actions.test.ts
git commit -m "feat(announcements): upload, replace and remove images, and delete announcements"
```

---

### Task 7: Admin pages

**Files:**
- Modify: `app/(admin)/layout.tsx` (lucide import list at the top, and the nav between Courses and Reports near line 97)
- Create: `app/(admin)/admin/announcements/page.tsx`, `app/(admin)/admin/announcements/loading.tsx`, `app/(admin)/admin/announcements/announcement-form.tsx`, `app/(admin)/admin/announcements/new/page.tsx`, `app/(admin)/admin/announcements/[id]/page.tsx`, `app/(admin)/admin/announcements/[id]/loading.tsx`, `app/(admin)/admin/announcements/[id]/delete-announcement-button.tsx`

**Interfaces:**
- Consumes: everything in `lib/announcements/` from Tasks 3 to 6, `groupCourses` from `@/lib/courses/grouping`.
- Produces: `AnnouncementForm({ announcement?: AnnouncementForEdit; courses: AnnouncementCourseOption[]; initialMessage?: string })`, `DeleteAnnouncementButton({ id: string; title: string })`.

These are presentation files with no unit tests of their own; their behaviour is covered by the action and helper tests and verified in the browser in Task 9.

- [ ] **Step 1: Add the sidebar item**

In `app/(admin)/layout.tsx`, add `Megaphone,` to the `lucide-react` import list, and insert between the Courses and Reports `NavLink`s:

```tsx
          <NavLink
            href="/admin/announcements"
            icon={<Megaphone className="w-4 h-4" aria-hidden="true" />}
            label="Announcements"
          />
```

- [ ] **Step 2: Create the list page and its loading state**

Create `app/(admin)/admin/announcements/loading.tsx`:

```tsx
export { AdminListLoading as default } from '@/components/loading-screens'
```

Create `app/(admin)/admin/announcements/page.tsx`:

```tsx
import Link from 'next/link'
import { ChevronRight, Megaphone, Pin } from 'lucide-react'
import { getAdminAnnouncements } from '@/lib/announcements/queries'
import { audienceSummary, formatAnnouncementDate } from '@/lib/announcements/format'
import { PageHeader } from '@/components/admin/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Announcements - AQA Admin' }

const th = 'text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide'

export default async function AnnouncementsPage() {
  const announcements = await getAdminAnnouncements()

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Announcements"
        action={
          <Button asChild>
            <Link href="/admin/announcements/new">New Announcement</Link>
          </Button>
        }
      />

      {announcements.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Megaphone className="w-8 h-8" aria-hidden="true" />
          <p className="text-sm">No announcements yet. Create the first one.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th scope="col" className={th}>Title</th>
                <th scope="col" className={th}>Audience</th>
                <th scope="col" className={th}>Status</th>
                <th scope="col" className={th}>Pinned</th>
                <th scope="col" className={th}>Published</th>
                <th scope="col" aria-label="Actions" className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {announcements.map((a) => (
                <tr key={a.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-2 font-medium">
                    <Link href={'/admin/announcements/' + a.id} className="hover:underline">
                      {a.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {audienceSummary(a.audience, a.courseTitles)}
                  </td>
                  <td className="px-4 py-2">
                    {a.isPublished
                      ? <Badge className="bg-green-100 text-green-800 border-green-200">Published</Badge>
                      : <Badge variant="outline">Draft</Badge>}
                  </td>
                  <td className="px-4 py-2">
                    {a.isPinned && (
                      <>
                        <Pin className="w-4 h-4 text-primary" aria-hidden="true" />
                        <span className="sr-only">Pinned</span>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                    {a.publishedAt ? formatAnnouncementDate(a.publishedAt) : '-'}
                  </td>
                  <td className="px-4 py-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={'/admin/announcements/' + a.id}>
                        Edit <ChevronRight className="w-3 h-3 ml-1" aria-hidden="true" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create the shared form**

Create `app/(admin)/admin/announcements/announcement-form.tsx`:

```tsx
'use client'

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from 'react'
import type { AnnouncementAudience } from '@prisma/client'
import { saveAnnouncementAction, type AnnouncementActionState } from '@/lib/announcements/actions'
import type { AnnouncementCourseOption, AnnouncementForEdit } from '@/lib/announcements/queries'
import { CONTENT_MAX, TITLE_MAX } from '@/lib/announcements/limits'
import { groupCheckState, toggleCourse, toggleGroup, type GroupCheckState } from '@/lib/announcements/picker'
import { groupCourses } from '@/lib/courses/grouping'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  announcement?: AnnouncementForEdit
  courses: AnnouncementCourseOption[]
  initialMessage?: string
}

export function AnnouncementForm({ announcement, courses, initialMessage }: Props) {
  const [state, formAction, isPending] = useActionState<AnnouncementActionState, FormData>(
    saveAnnouncementAction,
    { error: null, message: initialMessage },
  )
  const [audience, setAudience] = useState<AnnouncementAudience>(announcement?.audience ?? 'EVERYONE')
  const [selected, setSelected] = useState<Set<string>>(() => new Set(announcement?.courseIds))
  const [preview, setPreview] = useState<string | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  // Once a save lands, the chosen file is on the server; clear the picker so a
  // second save does not upload it again.
  useEffect(() => {
    if (!state.message) return
    if (fileRef.current) fileRef.current.value = ''
    setPreview(null)
    setRemoveImage(false)
  }, [state])

  // React resets a <form action> after every submission, which would wipe the
  // admin's text when the server rejects it. Submitting through a transition
  // keeps the fields, and passing the submitter keeps the clicked button's intent.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const formData = new FormData(event.currentTarget, submitter)
    startTransition(() => formAction(formData))
  }

  const isPublished = announcement?.isPublished ?? false
  const currentImage = announcement?.imageUrl && !removeImage ? announcement.imageUrl : null
  const shownImage = preview ?? currentImage

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {announcement && <input type="hidden" name="id" value={announcement.id} />}

          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span aria-hidden="true">*</span>
            </Label>
            <Input
              id="title"
              name="title"
              required
              maxLength={TITLE_MAX}
              defaultValue={announcement?.title}
              placeholder="e.g. Classes resume after Eid"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">
              Content <span aria-hidden="true">*</span>
            </Label>
            <Textarea
              id="content"
              name="content"
              required
              maxLength={CONTENT_MAX}
              rows={8}
              defaultValue={announcement?.content}
              placeholder="Write the announcement. Line breaks are kept."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Image</Label>
            {shownImage && (
              <img
                src={shownImage}
                alt=""
                className="w-full max-h-72 rounded-md border bg-muted object-contain"
              />
            )}
            <input
              ref={fileRef}
              id="image"
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="text-sm w-full"
              onChange={(e) => {
                const chosen = e.target.files?.[0]
                setPreview(chosen ? URL.createObjectURL(chosen) : null)
              }}
            />
            <p className="text-muted-foreground text-xs">
              Optional. JPG, PNG or WEBP, up to 10 MB.
              {announcement?.imageUrl ? ' Choosing a file replaces the current image.' : ''}
            </p>
            {announcement?.imageUrl && !preview && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="removeImage"
                  checked={removeImage}
                  onChange={(e) => setRemoveImage(e.target.checked)}
                  className="accent-primary"
                />
                Remove image
              </label>
            )}
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Audience</legend>
            <div className="flex flex-wrap gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="audience"
                  value="EVERYONE"
                  checked={audience === 'EVERYONE'}
                  onChange={() => setAudience('EVERYONE')}
                  className="accent-primary"
                />
                Everyone
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="audience"
                  value="COURSES"
                  checked={audience === 'COURSES'}
                  onChange={() => setAudience('COURSES')}
                  className="accent-primary"
                />
                Specific courses
              </label>
            </div>
            {audience === 'COURSES' && (
              <CoursePicker courses={courses} selected={selected} onChange={setSelected} />
            )}
          </fieldset>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="isPinned"
              defaultChecked={announcement?.isPinned}
              className="mt-0.5 accent-primary"
            />
            <span>
              <span className="font-medium">Pin to top</span>
              <span className="block text-xs text-muted-foreground">
                Pinned announcements stay above newer ones.
              </span>
            </span>
          </label>

          {state.error && (
            <p role="alert" className="text-destructive text-sm">{state.error}</p>
          )}
          {state.message && !state.error && (
            <p role="status" className="text-sm text-green-600">{state.message}</p>
          )}

          {/* The first submit button is the one Enter triggers, so it must never publish. */}
          <div className="flex flex-wrap items-center gap-2">
            {isPublished ? (
              <>
                <Button type="submit" name="intent" value="save" disabled={isPending}>
                  Save changes
                </Button>
                <Button type="submit" name="intent" value="unpublish" variant="outline" disabled={isPending}>
                  Unpublish
                </Button>
              </>
            ) : (
              <>
                <Button type="submit" name="intent" value="save" variant="outline" disabled={isPending}>
                  Save draft
                </Button>
                <Button type="submit" name="intent" value="publish" disabled={isPending}>
                  Publish
                </Button>
              </>
            )}
            {isPending && <span className="text-muted-foreground text-sm">Saving...</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

type PickerProps = {
  courses: AnnouncementCourseOption[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}

function CoursePicker({ courses, selected, onChange }: PickerProps) {
  if (courses.length === 0) {
    return <p className="text-muted-foreground text-sm">There are no active courses to choose from.</p>
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="max-h-80 space-y-3 overflow-y-auto">
        {groupCourses(courses).map((entry) => {
          if (entry.kind === 'single') {
            return (
              <CourseCheckbox
                key={entry.course.id}
                course={entry.course}
                checked={selected.has(entry.course.id)}
                onToggle={() => onChange(toggleCourse(entry.course.id, selected))}
              />
            )
          }
          const levelIds = entry.levels.map((c) => c.id)
          return (
            <div key={entry.groupName} className="space-y-2">
              <GroupCheckbox
                label={entry.groupName}
                state={groupCheckState(levelIds, selected)}
                onToggle={() => onChange(toggleGroup(levelIds, selected))}
              />
              <div className="ml-6 space-y-2">
                {entry.levels.map((course) => (
                  <CourseCheckbox
                    key={course.id}
                    course={course}
                    checked={selected.has(course.id)}
                    onToggle={() => onChange(toggleCourse(course.id, selected))}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-muted-foreground text-xs">
        {selected.size === 1 ? '1 course selected' : `${selected.size} courses selected`}
      </p>
    </div>
  )
}

function CourseCheckbox({
  course,
  checked,
  onToggle,
}: {
  course: AnnouncementCourseOption
  checked: boolean
  onToggle: () => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        name="courseIds"
        value={course.id}
        checked={checked}
        onChange={onToggle}
        className="accent-primary"
      />
      <span>{course.title}</span>
      {course.archived && <Badge variant="outline" className="text-xs">Archived</Badge>}
    </label>
  )
}

// Selecting a group is a convenience; only the individual courses are submitted.
function GroupCheckbox({
  label,
  state,
  onToggle,
}: {
  label: string
  state: GroupCheckState
  onToggle: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'some'
  }, [state])

  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
      <input
        ref={ref}
        type="checkbox"
        checked={state === 'all'}
        onChange={onToggle}
        className="accent-primary"
      />
      {label} <span className="text-muted-foreground font-normal">(all levels)</span>
    </label>
  )
}
```

- [ ] **Step 4: Create the new page**

Create `app/(admin)/admin/announcements/new/page.tsx`:

```tsx
import { getAnnouncementCourseOptions } from '@/lib/announcements/queries'
import { PageHeader } from '@/components/admin/page-header'
import { AnnouncementForm } from '../announcement-form'

export const metadata = { title: 'New Announcement - AQA Admin' }

export default async function NewAnnouncementPage() {
  const courses = await getAnnouncementCourseOptions()

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Announcements', href: '/admin/announcements' },
          { label: 'New' },
        ]}
        title="New Announcement"
      />
      <div className="max-w-3xl">
        <AnnouncementForm courses={courses} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create the edit page, its loading state and the delete button**

Create `app/(admin)/admin/announcements/[id]/loading.tsx`:

```tsx
export { AdminSplitDetailLoading as default } from '@/components/loading-screens'
```

Create `app/(admin)/admin/announcements/[id]/delete-announcement-button.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { deleteAnnouncementAction } from '@/lib/announcements/actions'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Props = { id: string; title: string }

export function DeleteAnnouncementButton({ id, title }: Props) {
  const [state, formAction, isPending] = useActionState(deleteAnnouncementAction, { error: null })
  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive text-sm">Danger Zone</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full" disabled={isPending}>
              {isPending ? 'Deleting...' : 'Delete Announcement'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete &quot;{title}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                Students will no longer see it, and its image is deleted too. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <form action={formAction}>
                <input type="hidden" name="id" value={id} />
                <AlertDialogAction
                  type="submit"
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </form>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      </CardContent>
    </Card>
  )
}
```

Create `app/(admin)/admin/announcements/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getAnnouncementCourseOptions, getAnnouncementForEdit } from '@/lib/announcements/queries'
import { PageHeader } from '@/components/admin/page-header'
import { Badge } from '@/components/ui/badge'
import { AnnouncementForm } from '../announcement-form'
import { DeleteAnnouncementButton } from './delete-announcement-button'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ created?: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const announcement = await getAnnouncementForEdit(id)
  return { title: (announcement?.title ?? 'Announcement') + ' - AQA Admin' }
}

export default async function EditAnnouncementPage({ params, searchParams }: Props) {
  const { id } = await params
  const { created } = await searchParams

  const announcement = await getAnnouncementForEdit(id)
  if (!announcement) notFound()

  const courses = await getAnnouncementCourseOptions(announcement.courseIds)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Announcements', href: '/admin/announcements' },
          { label: announcement.title },
        ]}
        title={announcement.title}
        action={
          announcement.isPublished
            ? <Badge className="bg-green-100 text-green-800 border-green-200">Published</Badge>
            : <Badge variant="outline">Draft</Badge>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AnnouncementForm
            announcement={announcement}
            courses={courses}
            initialMessage={created === '1' ? 'Announcement created.' : undefined}
          />
        </div>
        <div>
          <DeleteAnnouncementButton id={announcement.id} title={announcement.title} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Type-check and lint**

Run: `./node_modules/.bin/tsc --noEmit && pnpm lint`
Expected: no type errors and no new lint errors in the new files.
If lint flags `@next/next/no-img-element` on the preview `<img>`, keep the `<img>` (it shows a local `blob:` preview, which `next/image` cannot optimise) and match however `course-image-card.tsx` is treated.

- [ ] **Step 7: Smoke-test in the browser**

Start `pnpm dev`, sign in as an admin, and open `/admin/announcements`.
Check the sidebar item sits between Courses and Reports and highlights on the page, the empty state renders, and "New Announcement" opens the form.
Create a draft with the title "Smoke test" and confirm you land on its edit page with "Announcement created.".
Delete it and confirm you return to the list.

- [ ] **Step 8: Commit**

```bash
git add "app/(admin)/layout.tsx" "app/(admin)/admin/announcements"
git commit -m "feat(admin): manage announcements with course targeting and images"
```

---

### Task 8: Student pages

**Files:**
- Create: `components/student/announcement-card.tsx`, `app/(student)/student/announcements/page.tsx`, `app/(student)/student/announcements/loading.tsx`
- Modify: `app/(student)/student/dashboard/page.tsx` (imports near line 5, announcements section near line 167), `components/student/nav.tsx`

**Interfaces:**
- Consumes: `getStudentAnnouncements`, `StudentAnnouncement` (Task 4), `DASHBOARD_ANNOUNCEMENTS` (Task 4), `formatAnnouncementDate` (Task 3).
- Produces: `AnnouncementCard({ announcement: StudentAnnouncement; variant: 'compact' | 'full' })`.

- [ ] **Step 1: Create the card**

Create `components/student/announcement-card.tsx`:

```tsx
import Image from 'next/image'
import { Pin } from 'lucide-react'
import type { StudentAnnouncement } from '@/lib/announcements/queries'
import { formatAnnouncementDate } from '@/lib/announcements/format'

type Props = { announcement: StudentAnnouncement; variant: 'compact' | 'full' }

export function AnnouncementCard({ announcement: a, variant }: Props) {
  if (variant === 'compact') {
    return (
      <div className="border-border flex overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="bg-primary w-[3px] shrink-0" />
        <div className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-foreground flex items-center gap-1.5 text-sm font-medium">
              {a.isPinned && (
                <>
                  <Pin className="text-primary h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="sr-only">Pinned:</span>
                </>
              )}
              <span className="truncate">{a.title}</span>
            </p>
            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm whitespace-pre-line">
              {a.content}
            </p>
          </div>
          {a.imageUrl && (
            <Image
              src={a.imageUrl}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-md object-cover"
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <article className="border-border overflow-hidden rounded-lg border bg-white shadow-sm">
      {a.imageUrl && (
        <Image
          src={a.imageUrl}
          alt=""
          width={1200}
          height={800}
          sizes="(min-width: 768px) 672px, 100vw"
          className="h-auto w-full"
        />
      )}
      <div className="space-y-2 px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-foreground text-base font-semibold">{a.title}</h2>
          {a.isPinned && (
            <span className="text-primary inline-flex items-center gap-1 text-xs font-medium">
              <Pin className="h-3.5 w-3.5" aria-hidden="true" />
              Pinned
            </span>
          )}
        </div>
        {a.publishedAt && (
          <p className="text-muted-foreground text-xs">
            <time dateTime={a.publishedAt.toISOString()}>{formatAnnouncementDate(a.publishedAt)}</time>
          </p>
        )}
        <p className="text-foreground text-sm leading-relaxed whitespace-pre-line">{a.content}</p>
      </div>
    </article>
  )
}
```

- [ ] **Step 2: Use it on the dashboard**

In `app/(student)/student/dashboard/page.tsx`, extend the `@/lib/student/queries` import with `DASHBOARD_ANNOUNCEMENTS,` and add:

```tsx
import { AnnouncementCard } from "@/components/student/announcement-card";
```

Replace the whole `{/* Announcements */}` block with:

```tsx
      {/* Announcements */}
      {announcements.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-muted-foreground text-[10px] font-semibold tracking-[0.2em] uppercase">
              Announcements
            </h2>
            {announcements.length > DASHBOARD_ANNOUNCEMENTS && (
              <Link
                href="/student/announcements"
                className="text-primary text-xs font-medium hover:underline"
              >
                View all
              </Link>
            )}
          </div>
          <div className="space-y-2">
            {announcements.slice(0, DASHBOARD_ANNOUNCEMENTS).map((a) => (
              <AnnouncementCard key={a.id} announcement={a} variant="compact" />
            ))}
          </div>
        </section>
      )}
```

This file uses double quotes and semicolons; keep that style inside it.

- [ ] **Step 3: Create the announcements page**

Create `app/(student)/student/announcements/loading.tsx`:

```tsx
export { StudentLoading as default } from '@/components/loading-screens'
```

Create `app/(student)/student/announcements/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { Megaphone } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { getStudentAnnouncements } from '@/lib/announcements/queries'
import { AnnouncementCard } from '@/components/student/announcement-card'

export const metadata = { title: 'Announcements - AQA Student' }

export default async function StudentAnnouncementsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const announcements = await getStudentAnnouncements(session.userId)

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-6 py-10 md:px-10">
      <h1 className="text-foreground text-2xl font-bold tracking-tight">Announcements</h1>
      {announcements.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 py-12">
          <Megaphone className="h-8 w-8" aria-hidden="true" />
          <p className="text-sm">No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <AnnouncementCard key={a.id} announcement={a} variant="full" />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add the nav link**

In `components/student/nav.tsx`, insert between the Dashboard and Courses links:

```tsx
          <Link href="/student/announcements" className="text-white/70 hover:text-white text-sm hidden sm:block">Announcements</Link>
```

- [ ] **Step 5: Type-check, lint and run the whole suite**

Run: `./node_modules/.bin/tsc --noEmit && pnpm lint && pnpm exec vitest run`
Expected: no type errors, no new lint errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/student/announcement-card.tsx components/student/nav.tsx "app/(student)/student/announcements" "app/(student)/student/dashboard/page.tsx"
git commit -m "feat(student): show targeted announcements with images and a full announcements page"
```

---

### Task 9: End-to-end verification

**Files:** none, unless a defect is found (fix it in the file at fault, with a test when the defect is in `lib/`).

- [ ] **Step 1: Prepare accounts**

Run `pnpm dev`.
You need an admin, student A actively enrolled in one Marhala level, and student B enrolled only in a course outside the Marhala group.
Look for suitable accounts in `prisma/seed.ts` and the admin Students page; if none exist, ask the user for credentials rather than creating accounts on the shared database.

- [ ] **Step 2: Walk the spec's scenarios on desktop (1440 px wide)**

Using the Playwright browser tools:

1. As admin, create a draft "Marhala orientation" for the Marhala group with an image.
In the picker, tick the group box and confirm every level ticks; untick one level and confirm the group box shows indeterminate.
Re-tick it, save as draft.
As student A, confirm it does not appear.
2. As admin, publish it.
As student A, confirm it shows on the dashboard with its thumbnail and on `/student/announcements` with the full image and date.
As student B, confirm it appears in neither place.
3. As admin, create and publish "School holiday" for everyone, pinned.
Both students see it first, with the pin marker.
4. As admin, unpublish and republish "Marhala orientation".
Its published date in the admin list and its position for student A do not change.
5. As admin, replace its image, then save with "Remove image" ticked.
Student A's view updates each time and never shows a broken image.
6. Publish two more announcements for everyone so student A has at least 4.
The dashboard shows 3 and "View all"; the page shows all of them.
7. As admin, delete "Marhala orientation".
It disappears from the admin list and from both student views.

Also check the failure paths in the form: submit with an empty title, and with "Specific courses" but nothing ticked.
The error shows and the typed content is still in the fields.

- [ ] **Step 3: Repeat the student and admin views at phone width (390 px)**

Check the dashboard section, the announcements page, the admin list (horizontal scroll inside its border, not the page), and the form with the course picker.
Look for overflow, truncated titles that hide the pin, images wider than the viewport, and misaligned checkboxes.
Fix anything that looks off before continuing.

- [ ] **Step 4: Clean up test data**

Delete the announcements created during testing from the admin panel, and confirm their images are gone from the bucket listing in Supabase, or ask the user to check if you have no access.

- [ ] **Step 5: Final checks**

Run: `./node_modules/.bin/tsc --noEmit && pnpm lint && pnpm exec vitest run`
Expected: all green.
Commit any fixes made during this task with a message describing the defect fixed.
