# Course Archiving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken hard-delete of courses with an archive/restore flow that cannot fail on foreign key constraints.

**Architecture:** A nullable `Course.archivedAt` column marks a course as archived. Every course-facing read filters on `archivedAt: null` via one shared exported constant. The delete action becomes an update, so the `P2003` foreign key violation that breaks deletion today disappears entirely.

**Tech Stack:** Next.js App Router, React server actions, Prisma 7, PostgreSQL (Supabase), Vitest.

## Global Constraints

- Package manager is `pnpm`. Never `npm` or `yarn`.
- Prisma migrations cannot be run by the agent. The classifier blocks DB-touching Prisma commands, and `migrate dev` fails without a TTY. The user must run `pnpm prisma migrate dev --name <name>` in their own terminal. The agent then runs `pnpm prisma generate`.
- `app/generated/prisma/` is a stale, unused, git-tracked leftover. Do not edit it and do not grep it to check the client. Verify types with `./node_modules/.bin/tsc --noEmit`.
- `pnpm exec <cmd>` prints a harmless "Already up to date / Done in Nms using pnpm" preamble before real output.
- Tests mock `@/lib/db` with `vi.mock` and assert on the `where` argument. Follow the pattern in `lib/__tests__/subjects/enforcement.test.ts`.
- Do not write to `CHANGELOG.md`.
- Commit messages must not add a Co-Authored-By agent trailer.
- Work happens on the existing branch `feat/course-archiving`.

## File Structure

| File | Responsibility |
| --- | --- |
| `prisma/schema.prisma` | Adds `archivedAt` to `Course` |
| `lib/courses/archive.ts` | Create. The single shared `ACTIVE_COURSE` filter constant |
| `app/(admin)/admin/courses/actions.ts` | `archiveCourseAction` replaces `deleteCourseAction`; adds `restoreCourseAction` |
| `lib/courses/queries.ts` | Filters admin and public course reads |
| `lib/student/queries.ts` | Filters student reads |
| `lib/certificates/queries.ts` | Filters certificate eligibility |
| `lib/purchases/queries.ts` | Filters purchasable courses |
| `app/(admin)/admin/courses/[id]/archive-course-button.tsx` | Create. Replaces `delete-course-button.tsx` |
| `app/(admin)/admin/courses/page.tsx` | Active/Archived filter and Restore action |
| `lib/__tests__/courses/archive.test.ts` | Create. Action and filter tests |

---

### Task 1: Schema, migration, and the shared filter constant

**Files:**
- Modify: `prisma/schema.prisma:154-183`
- Create: `lib/courses/archive.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Course.archivedAt: Date | null` on the Prisma client, and `export const ACTIVE_COURSE: { readonly archivedAt: null }` from `@/lib/courses/archive`.

- [ ] **Step 1: Add the column to the Course model**

In `prisma/schema.prisma`, inside `model Course`, add `archivedAt` directly after the existing `updatedAt` line, and add the index alongside the relation block:

```prisma
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Set when an admin archives the course. Archived courses are hidden from
  // every catalog, admin, and student surface but are never destroyed.
  archivedAt DateTime?

  subjects      Subject[]
  enrollments   Enrollment[]
  certificates  Certificate[]
  purchaseItems PurchaseItem[]
  batches       Batch[]

  @@index([archivedAt])
```

- [ ] **Step 2: Ask the user to run the migration**

The agent cannot run this. Stop and tell the user verbatim:

> Please run this in your own terminal, then tell me when it is done:
> `pnpm prisma migrate dev --name add_course_archived_at`

Wait for confirmation before continuing.

- [ ] **Step 3: Regenerate the Prisma client**

Run: `pnpm prisma generate`
Expected: `Generated Prisma Client ... to ./node_modules/@prisma/client`

- [ ] **Step 4: Verify the field exists on the client**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: exit code 0, no output. Do not grep `app/generated/prisma`.

- [ ] **Step 5: Create the shared filter constant**

Create `lib/courses/archive.ts`:

```ts
// Archived courses are hidden from every catalog, admin, and student surface.
// This filter lives in one place so the rule stays greppable and there is a
// single spot to audit when a new course query is added.
export const ACTIVE_COURSE = { archivedAt: null } as const;
```

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/courses/archive.ts
git commit -m "feat: add Course.archivedAt and shared active-course filter"
```

---

### Task 2: Replace delete with archive and restore

This is the actual bug fix. `deleteCourseAction` currently fails with Prisma `P2003` for any course that has enrollments, purchases, or certificates, because those three relations use the default `onDelete: Restrict`.

**Files:**
- Modify: `app/(admin)/admin/courses/actions.ts:221-251`
- Create: `lib/__tests__/courses/archive.test.ts`

**Interfaces:**
- Consumes: `ACTIVE_COURSE` from Task 1 (not used here, but `archivedAt` must exist on the client).
- Produces: `archiveCourseAction(_prev: ActionState, formData: FormData): Promise<ActionState>` and `restoreCourseAction(_prev: ActionState, formData: FormData): Promise<ActionState>`, both reading `formData.get("id")`.

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/courses/archive.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { course: { update: vi.fn() } },
}));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import {
  archiveCourseAction,
  restoreCourseAction,
} from "@/app/(admin)/admin/courses/actions";

function form(id: string) {
  const f = new FormData();
  f.set("id", id);
  return f;
}

describe("archiveCourseAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({ role: "ADMIN" } as never);
  });

  // The original bug: a course with enrollments and purchase items could not
  // be removed at all, because deleting it violated PurchaseItem_courseId_fkey.
  // Archiving only writes a timestamp, so no foreign key is ever touched.
  it("archives a course by setting archivedAt without deleting any rows", async () => {
    vi.mocked(db.course.update).mockResolvedValue({} as never);

    await expect(archiveCourseAction({ error: null }, form("c1"))).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(db.course.update).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(db.course.update).mock.calls[0][0];
    expect(arg.where).toEqual({ id: "c1" });
    expect(arg.data.archivedAt).toBeInstanceOf(Date);
  });

  it("rejects a non-admin", async () => {
    vi.mocked(getSession).mockResolvedValue({ role: "STUDENT" } as never);
    const r = await archiveCourseAction({ error: null }, form("c1"));
    expect(r.error).toBe("Forbidden");
    expect(db.course.update).not.toHaveBeenCalled();
  });

  it("rejects a missing id", async () => {
    const r = await archiveCourseAction({ error: null }, new FormData());
    expect(r.error).toBe("Invalid course ID.");
    expect(db.course.update).not.toHaveBeenCalled();
  });
});

describe("restoreCourseAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({ role: "ADMIN" } as never);
  });

  it("clears archivedAt", async () => {
    vi.mocked(db.course.update).mockResolvedValue({} as never);

    const r = await restoreCourseAction({ error: null }, form("c1"));

    expect(r.error).toBeNull();
    expect(db.course.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { archivedAt: null },
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run lib/__tests__/courses/archive.test.ts`
Expected: FAIL, because `archiveCourseAction` is not exported.

- [ ] **Step 3: Replace the action**

In `app/(admin)/admin/courses/actions.ts`, delete the whole `deleteCourseAction` function (lines 221-251) and put this in its place:

```ts
export async function archiveCourseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };
  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")
    return { error: "Forbidden" };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Invalid course ID." };

  try {
    // Archiving never touches Enrollment, PurchaseItem, or Certificate, so it
    // cannot hit the FK restriction that made the old hard delete fail.
    await db.course.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  } catch (err) {
    console.error("[archiveCourse]", err);
    return { error: "A database error occurred. Please try again." };
  }

  revalidatePath("/admin/courses");
  redirect("/admin/courses");
}

export async function restoreCourseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };
  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")
    return { error: "Forbidden" };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Invalid course ID." };

  try {
    await db.course.update({ where: { id }, data: { archivedAt: null } });
  } catch (err) {
    console.error("[restoreCourse]", err);
    return { error: "A database error occurred. Please try again." };
  }

  revalidatePath("/admin/courses");
  return { error: null, success: true };
}
```

If `Prisma` is now an unused import in this file, remove it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run lib/__tests__/courses/archive.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add app/\(admin\)/admin/courses/actions.ts lib/__tests__/courses/archive.test.ts
git commit -m "fix: archive courses instead of deleting to avoid FK violation"
```

---

### Task 3: Filter admin and public course queries

**Files:**
- Modify: `lib/courses/queries.ts:29-30, 90-91, 127-128, 267-272, 274-276, 295-297`
- Modify: `app/(admin)/admin/dashboard/page.tsx:31`
- Modify: `lib/__tests__/courses/archive.test.ts`

**Interfaces:**
- Consumes: `ACTIVE_COURSE` from Task 1.
- Produces: `getCourses(includeArchived?: boolean)` — when `true`, returns only archived courses for the admin Archived view. `CourseRow` gains `archivedAt: Date | null`.

- [ ] **Step 1: Write the failing test**

Append to `lib/__tests__/courses/archive.test.ts`. Note this needs its own mock surface, so put it in a new file `lib/__tests__/courses/archive-filters.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    course: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import {
  getPublishedCourses,
  getCourses,
  getCourseById,
} from "@/lib/courses/queries";

describe("course queries exclude archived courses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.course.findMany).mockResolvedValue([] as never);
    vi.mocked(db.course.findUnique).mockResolvedValue(null as never);
  });

  it("getPublishedCourses filters archivedAt: null", async () => {
    await getPublishedCourses();
    const arg = vi.mocked(db.course.findMany).mock.calls[0][0];
    expect(arg.where).toMatchObject({ isPublished: true, archivedAt: null });
  });

  it("getCourses filters archivedAt: null by default", async () => {
    await getCourses();
    const arg = vi.mocked(db.course.findMany).mock.calls[0][0];
    expect(arg.where).toEqual({ archivedAt: null });
  });

  it("getCourses(true) returns only archived courses", async () => {
    await getCourses(true);
    const arg = vi.mocked(db.course.findMany).mock.calls[0][0];
    expect(arg.where).toEqual({ archivedAt: { not: null } });
  });

  it("getCourseById filters archivedAt: null", async () => {
    await getCourseById("c1");
    const arg = vi.mocked(db.course.findUnique).mock.calls[0][0];
    expect(arg.where).toMatchObject({ id: "c1", archivedAt: null });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run lib/__tests__/courses/archive-filters.test.ts`
Expected: FAIL, `where` has no `archivedAt`.

- [ ] **Step 3: Apply the filters**

In `lib/courses/queries.ts`, add the import at the top:

```ts
import { ACTIVE_COURSE } from "@/lib/courses/archive";
```

Then change each `where` clause:

Line 30, `getPublishedCourses`:
```ts
    where: { isPublished: true, ...ACTIVE_COURSE, ...(type ? { courseType: type } : {}) },
```

Line 91, `getPublicCourseDetail`:
```ts
    where: { id, isPublished: true, ...ACTIVE_COURSE },
```

Line 128, `getPublishedCourseById`:
```ts
    where: { id, ...ACTIVE_COURSE },
```

Lines 267-272, `getCourseOptions`:
```ts
export async function getCourseOptions(): Promise<CourseOption[]> {
  return db.course.findMany({
    where: { ...ACTIVE_COURSE },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });
}
```

Lines 274-276, `getCourses` — add the parameter and the `archivedAt` field to the select:
```ts
export async function getCourses(includeArchived = false): Promise<CourseRow[]> {
  return db.course.findMany({
    where: includeArchived ? { archivedAt: { not: null } } : { ...ACTIVE_COURSE },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      isPublished: true,
      courseType: true,
      passingGrade: true,
      meetLink: true,
      courseDuration: true,
      createdAt: true,
      archivedAt: true,
      _count: {
        select: { subjects: true },
      },
    },
  });
}
```

Add `archivedAt: Date | null` to the `CourseRow` type in the same file.

Line 297, `getCourseById`:
```ts
    where: { id, ...ACTIVE_COURSE },
```

`getPublicCourseGroup` needs no change; it calls `getPublishedCourses`, which is now filtered.

For `getSubjectById` (line 342) and `getLessonById` (line 393), filter through the course relation:
```ts
    // getSubjectById
    where: { id: sid, course: { ...ACTIVE_COURSE } },
```
```ts
    // getLessonById
    where: { id: lid, subject: { course: { ...ACTIVE_COURSE } } },
```

In `app/(admin)/admin/dashboard/page.tsx:31`:
```ts
    db.course.count({ where: { isPublished: true, archivedAt: null } }),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run lib/__tests__/courses/archive-filters.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
git add lib/courses/queries.ts app/\(admin\)/admin/dashboard/page.tsx lib/__tests__/courses/archive-filters.test.ts
git commit -m "feat: exclude archived courses from admin and public queries"
```

---

### Task 4: Filter student, certificate, and purchase queries

Archived courses are hidden from students completely, including certificates.

**Files:**
- Modify: `lib/student/queries.ts:53-140, 197-198`
- Modify: `lib/certificates/queries.ts:19-20`
- Modify: `lib/purchases/queries.ts:26-27`
- Modify: `lib/__tests__/courses/archive-filters.test.ts`

**Interfaces:**
- Consumes: `ACTIVE_COURSE` from Task 1.
- Produces: nothing new. Signatures are unchanged.

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/courses/archive-student.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    course: { findUnique: vi.fn(), findMany: vi.fn() },
    enrollment: { findUnique: vi.fn(), findMany: vi.fn() },
    purchaseItem: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { getStudentCourse } from "@/lib/student/queries";
import { getCertificateEligibility } from "@/lib/certificates/queries";
import { getPurchasableCourses } from "@/lib/purchases/queries";

describe("student-facing queries exclude archived courses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue({ gender: "MALE" } as never);
    vi.mocked(db.course.findUnique).mockResolvedValue(null as never);
    vi.mocked(db.course.findMany).mockResolvedValue([] as never);
    vi.mocked(db.enrollment.findUnique).mockResolvedValue(null as never);
    vi.mocked(db.enrollment.findMany).mockResolvedValue([] as never);
    vi.mocked(db.purchaseItem.findMany).mockResolvedValue([] as never);
  });

  it("getStudentCourse filters archivedAt: null", async () => {
    await getStudentCourse("u1", "c1");
    const arg = vi.mocked(db.course.findUnique).mock.calls[0][0];
    expect(arg.where).toMatchObject({ id: "c1", archivedAt: null });
  });

  // Full blackout: an archived course takes its certificate with it.
  it("getCertificateEligibility filters archivedAt: null", async () => {
    await getCertificateEligibility("u1", "c1");
    const arg = vi.mocked(db.course.findUnique).mock.calls[0][0];
    expect(arg.where).toMatchObject({ id: "c1", archivedAt: null });
  });

  it("getPurchasableCourses filters archivedAt: null", async () => {
    await getPurchasableCourses("u1");
    const arg = vi.mocked(db.course.findMany).mock.calls[0][0];
    expect(arg.where).toMatchObject({ isPublished: true, archivedAt: null });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run lib/__tests__/courses/archive-student.test.ts`
Expected: FAIL on all three.

- [ ] **Step 3: Apply the filters**

Add to the top of each of the three files:
```ts
import { ACTIVE_COURSE } from "@/lib/courses/archive";
```

`lib/student/queries.ts:198`, in `getStudentCourse`:
```ts
      where: { id: courseId, isPublished: true, ...ACTIVE_COURSE },
```

`lib/student/queries.ts`, in `getStudentDashboard` — the enrollment list at line ~61 pulls `course`, so restrict the enrollments themselves:
```ts
      where: { userId, course: { ...ACTIVE_COURSE } },
```

Apply the same `course: { ...ACTIVE_COURSE }` restriction inside `getStudentSubject`, `getStudentAssessmentLaunch`, `getStudentAttempt`, and `getStudentRecentResults`, reaching the course through the existing `subject` relation where there is no direct `course` field:
```ts
      where: { id: sid, course: { ...ACTIVE_COURSE } },
```

`lib/certificates/queries.ts:20`:
```ts
      where: { id: courseId, ...ACTIVE_COURSE },
```

`lib/purchases/queries.ts:27`:
```ts
      where: { isPublished: true, ...ACTIVE_COURSE },
```

No change is needed in `lib/purchases/actions.ts`. Line 36 already validates submitted `courseIds` against the set returned by `getPurchasableCourses`, so filtering that query closes the checkout hole automatically. `getCheckoutCourses` is likewise covered, since it delegates to `getPurchasableCourses`.

Leave `getAdminPurchasesByStatus` and `getAdminPurchaseById` unfiltered. Archived course titles must still appear in admin purchase history, otherwise past purchases render as empty rows.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run lib/__tests__/courses/archive-student.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Run the whole suite and typecheck**

Run: `pnpm vitest run && ./node_modules/.bin/tsc --noEmit`
Expected: all tests pass, exit code 0. The existing `lib/__tests__/subjects/enforcement.test.ts` mocks `db.subject.findUnique`, so confirm the added `course` filter did not break its assertions. Fix that test's expectations if it asserts on an exact `where` object.

- [ ] **Step 6: Commit**

```bash
git add lib/student/queries.ts lib/certificates/queries.ts lib/purchases/queries.ts lib/__tests__/courses/archive-student.test.ts
git commit -m "feat: hide archived courses from student, certificate, and purchase surfaces"
```

---

### Task 5: Admin UI for archive and restore

**Files:**
- Create: `app/(admin)/admin/courses/[id]/archive-course-button.tsx`
- Delete: `app/(admin)/admin/courses/[id]/delete-course-button.tsx`
- Modify: `app/(admin)/admin/courses/[id]/page.tsx`
- Create: `app/(admin)/admin/courses/restore-course-button.tsx`
- Modify: `app/(admin)/admin/courses/page.tsx`

**Interfaces:**
- Consumes: `archiveCourseAction` and `restoreCourseAction` from Task 2, `getCourses(includeArchived)` from Task 3.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Create the archive button**

Create `app/(admin)/admin/courses/[id]/archive-course-button.tsx`. This mirrors the old delete button but with non-destructive copy:

```tsx
'use client'

import { useActionState } from 'react'
import { archiveCourseAction } from '../actions'
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

type Props = { courseId: string; courseTitle: string }

export function ArchiveCourseButton({ courseId, courseTitle }: Props) {
  const [state, formAction, isPending] = useActionState(archiveCourseAction, { error: null })
  return (
    <div className="space-y-1">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="w-full" disabled={isPending}>
            {isPending ? 'Archiving...' : 'Archive Course'}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive &quot;{courseTitle}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              The course will be hidden from students, the catalog, and this list. Nothing is
              deleted, and you can restore it from the Archived tab at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <form action={formAction}>
              <input type="hidden" name="id" value={courseId} />
              <AlertDialogAction
                type="submit"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Archive
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Swap the button in the course detail page**

Run: `grep -n "DeleteCourseButton" "app/(admin)/admin/courses/[id]/page.tsx"`

Replace the import and the JSX usage with `ArchiveCourseButton` from `./archive-course-button`, keeping the same props. Then delete the old file:

```bash
git rm "app/(admin)/admin/courses/[id]/delete-course-button.tsx"
```

- [ ] **Step 3: Create the restore button**

Create `app/(admin)/admin/courses/restore-course-button.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { restoreCourseAction } from './actions'
import { Button } from '@/components/ui/button'

export function RestoreCourseButton({ courseId }: { courseId: string }) {
  const [state, formAction, isPending] = useActionState(restoreCourseAction, { error: null })
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={courseId} />
      <Button type="submit" variant="outline" size="sm" disabled={isPending}>
        {isPending ? 'Restoring...' : 'Restore'}
      </Button>
      {state.error && <span className="ml-2 text-sm text-destructive">{state.error}</span>}
    </form>
  )
}
```

- [ ] **Step 4: Add the Active/Archived filter to the course list**

Modify `app/(admin)/admin/courses/page.tsx`. Read the archived state from the URL so the tabs are plain links and no client state is needed:

```tsx
export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view } = await searchParams
  const showArchived = view === 'archived'
  const courses = await getCourses(showArchived)
```

Render the tabs above the table:

```tsx
<div className="flex gap-2">
  <Button asChild variant={showArchived ? 'ghost' : 'secondary'} size="sm">
    <Link href="/admin/courses">Active</Link>
  </Button>
  <Button asChild variant={showArchived ? 'secondary' : 'ghost'} size="sm">
    <Link href="/admin/courses?view=archived">Archived</Link>
  </Button>
</div>
```

In the archived view, add a trailing cell per row showing the archive date and the restore control:

```tsx
{showArchived && (
  <td className="px-4 py-2 text-right">
    <span className="mr-3 text-muted-foreground text-xs">
      {course.archivedAt ? dateFormatter.format(course.archivedAt) : null}
    </span>
    <RestoreCourseButton courseId={course.id} />
  </td>
)}
```

Add a matching `<th>` guarded by `showArchived`, and update the empty state so the archived view reads "No archived courses." instead of prompting to create one.

- [ ] **Step 5: Verify in the running app**

Run the app and confirm the full loop by hand:

1. Open `/admin/courses`, pick a course with purchases such as `Kids Program`, and archive it. This is the exact case that fails today.
2. Confirm it disappears from `/admin/courses` and from the public catalog.
3. Open `/admin/courses?view=archived`, confirm it is listed with its archive date, and click Restore.
4. Confirm it returns to the Active list and the public catalog.

Use the `verify` skill to drive this rather than asserting from tests alone.

- [ ] **Step 6: Lint, typecheck, and full test run**

Run: `pnpm lint && ./node_modules/.bin/tsc --noEmit && pnpm vitest run`
Expected: no lint errors, exit code 0, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add archive and restore controls to admin courses UI"
```

---

## Self-Review

**Spec coverage:** Schema (Task 1), archive action and the P2003 fix (Task 2), the filtering table (Tasks 3 and 4), admin purchase history exception (Task 4 Step 3), server-side guards (Task 4 Step 3, already structurally satisfied at `lib/purchases/actions.ts:36`), admin UI with Active/Archived and Restore (Task 5), regression test for a course with enrollments and purchase items (Task 2 Step 1). All covered.

**Type consistency:** `ACTIVE_COURSE` is named identically in Tasks 1, 3, and 4. `getCourses(includeArchived)` is defined in Task 3 and consumed in Task 5. `archiveCourseAction` and `restoreCourseAction` are defined in Task 2 and consumed in Task 5. `CourseRow.archivedAt` is added in Task 3 and read in Task 5.

**Known risk:** Task 4 Step 5 flags that `lib/__tests__/subjects/enforcement.test.ts` may assert on an exact `where` object and could break when the `course` filter is added. Handling it is part of that step rather than a surprise later.
