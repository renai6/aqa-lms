# Move Enrollment to Another Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin move a student's active enrollment from course A to course B, carrying their payments with them, to fix wrong-level placements.

**Architecture:** One new server action `moveEnrollmentCourseAction` in `lib/enrollments/actions.ts` runs a single locked transaction: create or restore the course B enrollment, re-point all `Payment` rows to it, soft-remove course A.
A pure helper builds the course picker options, a small query loads the candidate courses with their batches, and the roster and student-profile queries gain the three fields the button needs.
A new dialog button, modelled on `components/admin/move-enrollment-button.tsx`, is wired into the course roster and the student profile.

**Tech Stack:** Next.js 16 server actions, Prisma 7 (`@prisma/client`), Vitest with `vi.mock("@/lib/db")`, Radix AlertDialog/Select via `components/ui`.

**Spec:** `docs/superpowers/specs/2026-10-04-move-enrollment-course-design.md`

## Global Constraints

- Package manager is pnpm. Never npm or yarn.
- No Prisma schema change and no migration.
- Never run `prettier --write` on existing files; match each file's own style (`lib/enrollments/*` and tests: double quotes + semicolons; `lib/students/queries.ts` and `app/(admin)/admin/students/[id]/page.tsx`: single quotes, no semicolons).
- Never use the em dash character in code, comments or UI copy; use a plain `-`.
- Commit messages must not include a co-author or "Generated with" line for the agent.
- Removal reason written to course A is exactly `Moved to <course B title>`.
- `paymentFrequency` must be equal for both courses; `null` is its own value.
- For a `MONTHLY` destination, `totalDue` is always stored as `null`.

## Review Focus

1. Course B has a removed enrollment that still holds old payments: after the move it holds both its old payments and course A's, and the balance counts all approved ones. Pinned in Task 2 ("restores a removed course B enrollment").
2. Course B form field `totalDue` is blank: the enrollment becomes untracked (`null`), not `0`. Pinned in Task 2 ("stores a blank total as untracked").
3. Destination is `MONTHLY` but a crafted POST sends `totalDue`: stored as `null`. Pinned in Task 2 ("ignores totalDue for a monthly course").
4. A certificate is issued between the dialog opening and the confirm click: the in-transaction re-check refuses and nothing is written. Pinned in Task 2 ("refuses when a certificate exists").
5. The student is enrolled in course B in another tab between opening and confirming: the in-transaction re-check refuses. Pinned in Task 2 ("refuses when already actively enrolled in course B").

---

### Task 1: Branch setup

The current branch `feat/recording-folders` holds unrelated uncommitted work. This feature must be built on its own branch from `main`.

**Files:**
- Commit: `docs/superpowers/specs/2026-10-04-move-enrollment-course-design.md`, `docs/superpowers/plans/2026-10-04-move-enrollment-course.md`

- [ ] **Step 1: Create an isolated worktree from main**

Use superpowers:using-git-worktrees to create a worktree on a new branch `feat/move-enrollment-course` from `main`.

- [ ] **Step 2: Copy the spec and plan into the worktree**

```bash
mkdir -p <worktree>/docs/superpowers/specs <worktree>/docs/superpowers/plans
cp /home/supremo/dev/aqa-lms/docs/superpowers/specs/2026-10-04-move-enrollment-course-design.md <worktree>/docs/superpowers/specs/
cp /home/supremo/dev/aqa-lms/docs/superpowers/plans/2026-10-04-move-enrollment-course.md <worktree>/docs/superpowers/plans/
```

- [ ] **Step 3: Install and confirm the baseline is green**

Run (in the worktree): `pnpm install && pnpm test --run && pnpm lint`
Expected: all tests pass, lint clean. If anything fails on a clean `main`, fix it first as its own commit.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers
git commit -m "docs: spec and plan for moving a student to another course"
```

---

### Task 2: `moveEnrollmentCourseAction`

**Files:**
- Modify: `lib/enrollments/actions.ts` (add import, error class, action at end of file)
- Test: `lib/__tests__/enrollments/move-course.test.ts` (create)

**Interfaces:**
- Consumes: existing `loadTarget(formData)` and `revalidateSurfaces(userId, courseId)` in the same file.
- Produces: `export async function moveEnrollmentCourseAction(_prev: { error: string | null }, formData: FormData): Promise<{ error: string | null }>`.
Form fields: `enrollmentId`, `courseId`, `batchId`, `totalDue`.

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/enrollments/move-course.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    enrollment: { findUnique: vi.fn() },
    course: { findUnique: vi.fn() },
    batch: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { moveEnrollmentCourseAction } from "@/lib/enrollments/actions";

const initial = { error: null };

let tx: {
  $queryRaw: ReturnType<typeof vi.fn>;
  enrollment: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  certificate: { findUnique: ReturnType<typeof vi.fn> };
  payment: { updateMany: ReturnType<typeof vi.fn> };
};

function form(fields: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("enrollmentId", "eA");
  fd.set("courseId", "cB");
  fd.set("batchId", "bB");
  fd.set("totalDue", "12000");
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const courseA = { title: "Marhala 1", archivedAt: null, paymentFrequency: "ONE_TIME" };
const courseB = { title: "Marhala 2", archivedAt: null, paymentFrequency: "ONE_TIME" };

// tx.enrollment.findUnique answers two different lookups: the locked course A
// row (by id) and the student's course B row (by userId_courseId).
function txEnrollmentLookups(courseBRow: unknown) {
  tx.enrollment.findUnique.mockImplementation(
    ({ where }: { where: { id?: string } }) =>
      Promise.resolve(
        where.id === "eA"
          ? { removedAt: null, paymentStatus: "PARTIALLY_PAID" }
          : courseBRow,
      ),
  );
}

describe("moveEnrollmentCourseAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({ userId: "a1", role: "ADMIN" } as never);
    vi.mocked(db.enrollment.findUnique).mockResolvedValue({
      userId: "u1",
      courseId: "cA",
      removedAt: null,
    } as never);
    vi.mocked(db.course.findUnique).mockImplementation((({
      where,
    }: {
      where: { id: string };
    }) =>
      Promise.resolve(
        where.id === "cA" ? courseA : where.id === "cB" ? courseB : null,
      )) as never);
    vi.mocked(db.batch.findUnique).mockResolvedValue({ courseId: "cB" } as never);

    tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      enrollment: {
        findUnique: vi.fn(),
        create: vi.fn().mockResolvedValue({ id: "eB" }),
        update: vi.fn().mockResolvedValue({ id: "eB" }),
      },
      certificate: { findUnique: vi.fn().mockResolvedValue(null) },
      payment: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
    txEnrollmentLookups(null);
    vi.mocked(db.$transaction).mockImplementation(((
      cb: (t: unknown) => unknown,
    ) => cb(tx)) as unknown as typeof db.$transaction);
  });

  it("creates the course B enrollment, moves payments, and removes course A", async () => {
    const result = await moveEnrollmentCourseAction(initial, form());

    expect(result.error).toBeNull();
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.enrollment.create).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        courseId: "cB",
        batchId: "bB",
        totalDue: 12000,
        paymentStatus: "PARTIALLY_PAID",
      },
      select: { id: true },
    });
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { enrollmentId: "eA" },
      data: { enrollmentId: "eB" },
    });
    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id: "eA" },
      data: { removedAt: expect.any(Date), removedReason: "Moved to Marhala 2" },
    });
  });

  it("restores a removed course B enrollment instead of creating one", async () => {
    txEnrollmentLookups({ id: "eB-old", removedAt: new Date() });

    const result = await moveEnrollmentCourseAction(initial, form());

    expect(result.error).toBeNull();
    expect(tx.enrollment.create).not.toHaveBeenCalled();
    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id: "eB-old" },
      data: {
        batchId: "bB",
        totalDue: 12000,
        paymentStatus: "PARTIALLY_PAID",
        removedAt: null,
        removedReason: null,
      },
      select: { id: true },
    });
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { enrollmentId: "eA" },
      data: { enrollmentId: "eB-old" },
    });
  });

  it("stores a blank total as untracked", async () => {
    await moveEnrollmentCourseAction(initial, form({ totalDue: "  " }));

    expect(tx.enrollment.create.mock.calls[0][0].data.totalDue).toBeNull();
  });

  it("ignores totalDue for a monthly course", async () => {
    courseA.paymentFrequency = "MONTHLY";
    courseB.paymentFrequency = "MONTHLY";
    try {
      await moveEnrollmentCourseAction(initial, form({ totalDue: "5000" }));
      expect(tx.enrollment.create.mock.calls[0][0].data.totalDue).toBeNull();
    } finally {
      courseA.paymentFrequency = "ONE_TIME";
      courseB.paymentFrequency = "ONE_TIME";
    }
  });

  it("revalidates both courses and both batches lists", async () => {
    await moveEnrollmentCourseAction(initial, form());

    for (const path of [
      "/admin/students/u1",
      "/admin/courses/cA",
      "/admin/courses/cB",
      "/admin/courses/cA/batches",
      "/admin/courses/cB/batches",
    ])
      expect(revalidatePath).toHaveBeenCalledWith(path);
  });

  describe("refusals", () => {
    async function expectRefused(fields: Record<string, string>, error: string) {
      const result = await moveEnrollmentCourseAction(initial, form(fields));
      expect(result.error).toBe(error);
      expect(tx.enrollment.create).not.toHaveBeenCalled();
      expect(tx.payment.updateMany).not.toHaveBeenCalled();
    }

    it("rejects a non-admin", async () => {
      vi.mocked(getSession).mockResolvedValue({ userId: "t1", role: "TEACHER" } as never);
      await expectRefused({}, "Forbidden");
    });

    it("rejects a removed course A enrollment", async () => {
      vi.mocked(db.enrollment.findUnique).mockResolvedValue({
        userId: "u1",
        courseId: "cA",
        removedAt: new Date(),
      } as never);
      await expectRefused({}, "This student is already removed from the course.");
    });

    it("rejects moving into the same course", async () => {
      await expectRefused({ courseId: "cA" }, "Choose a different course.");
    });

    it("rejects an unknown course", async () => {
      await expectRefused({ courseId: "cX" }, "Course not found.");
    });

    it("rejects an archived course", async () => {
      vi.mocked(db.course.findUnique).mockImplementation((({
        where,
      }: {
        where: { id: string };
      }) =>
        Promise.resolve(
          where.id === "cA" ? courseA : { ...courseB, archivedAt: new Date() },
        )) as never);
      await expectRefused({}, "That course is archived.");
    });

    it("rejects courses that are billed differently", async () => {
      vi.mocked(db.course.findUnique).mockImplementation((({
        where,
      }: {
        where: { id: string };
      }) =>
        Promise.resolve(
          where.id === "cA" ? courseA : { ...courseB, paymentFrequency: null },
        )) as never);
      await expectRefused(
        {},
        "These courses are billed differently, so payments cannot move between them.",
      );
    });

    it("rejects a missing batch", async () => {
      vi.mocked(db.batch.findUnique).mockResolvedValue(null as never);
      await expectRefused({}, "Batch not found.");
    });

    it("rejects a batch from another course", async () => {
      vi.mocked(db.batch.findUnique).mockResolvedValue({ courseId: "cA" } as never);
      await expectRefused({}, "That batch belongs to a different course.");
    });

    it("rejects a negative or non-numeric total", async () => {
      await expectRefused({ totalDue: "-1" }, "Total due must be zero or a positive number.");
      await expectRefused({ totalDue: "abc" }, "Total due must be zero or a positive number.");
    });

    // Re-checked inside the locked transaction, so a certificate issued after
    // the dialog opened still blocks the move.
    it("refuses when a certificate exists", async () => {
      tx.certificate.findUnique.mockResolvedValue({ id: "cert1" });
      await expectRefused(
        {},
        "A certificate has been issued for this course, so the student can no longer be moved.",
      );
      expect(tx.enrollment.update).not.toHaveBeenCalled();
    });

    it("refuses when already actively enrolled in course B", async () => {
      txEnrollmentLookups({ id: "eB", removedAt: null });
      await expectRefused({}, "This student is already enrolled in Marhala 2.");
      expect(tx.enrollment.update).not.toHaveBeenCalled();
    });

    it("refuses when course A was removed after the first read", async () => {
      tx.enrollment.findUnique.mockImplementation(
        ({ where }: { where: { id?: string } }) =>
          Promise.resolve(
            where.id === "eA"
              ? { removedAt: new Date(), paymentStatus: "PARTIALLY_PAID" }
              : null,
          ),
      );
      await expectRefused({}, "This student is already removed from the course.");
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test --run lib/__tests__/enrollments/move-course.test.ts`
Expected: FAIL, `moveEnrollmentCourseAction` is not exported.

- [ ] **Step 3: Implement the action**

In `lib/enrollments/actions.ts`, add the import under the existing `next/cache` import:

```ts
import type { Prisma } from "@prisma/client";
```

Append at the end of the file:

```ts
// Thrown inside the transaction to abort it with a message for the admin.
class MoveRefusedError extends Error {}

// Moving a student to another course fixes a wrong-level placement. Course A's
// enrollment is soft-removed, so its progress, grades and attempts stay put
// (they key off course A's own lessons and subjects and mean nothing in course
// B). The money moves: every Payment row is re-pointed at course B's
// enrollment, and computeBalance derives the new balance from those rows and
// the totalDue the admin confirms here. Matching paymentFrequency keeps each
// payment's periodMonth meaningful on the other side.
export async function moveEnrollmentCourseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const target = await loadTarget(formData);
  if ("error" in target) return { error: target.error };

  const { id, enrollment } = target;
  if (enrollment.removedAt)
    return { error: "This student is already removed from the course." };

  const courseId = formData.get("courseId");
  if (typeof courseId !== "string" || !courseId)
    return { error: "Invalid course ID." };
  if (courseId === enrollment.courseId)
    return { error: "Choose a different course." };

  const batchId = formData.get("batchId");
  if (typeof batchId !== "string" || !batchId)
    return { error: "Invalid batch ID." };

  const [source, destination, batch] = await Promise.all([
    db.course.findUnique({
      where: { id: enrollment.courseId },
      select: { paymentFrequency: true },
    }),
    db.course.findUnique({
      where: { id: courseId },
      select: { title: true, archivedAt: true, paymentFrequency: true },
    }),
    db.batch.findUnique({ where: { id: batchId }, select: { courseId: true } }),
  ]);
  if (!destination) return { error: "Course not found." };
  if (destination.archivedAt) return { error: "That course is archived." };
  if (source?.paymentFrequency !== destination.paymentFrequency)
    return {
      error:
        "These courses are billed differently, so payments cannot move between them.",
    };
  if (!batch) return { error: "Batch not found." };
  if (batch.courseId !== courseId)
    return { error: "That batch belongs to a different course." };

  // Monthly enrollments have no single agreed total; the per-month ledger is
  // their balance. Same rule as purchase approval.
  const rawTotal = formData.get("totalDue");
  const total = typeof rawTotal === "string" ? rawTotal.trim() : "";
  const totalDue =
    destination.paymentFrequency === "MONTHLY" || total === ""
      ? null
      : Number(total);
  if (totalDue !== null && (!Number.isFinite(totalDue) || totalDue < 0))
    return { error: "Total due must be zero or a positive number." };

  const { userId } = enrollment;
  try {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      // Two admins moving the same student at once would otherwise both pass
      // the checks above and both move the payments.
      await tx.$queryRaw`SELECT id FROM "Enrollment" WHERE id = ${id} FOR UPDATE`;

      const current = await tx.enrollment.findUnique({
        where: { id },
        select: { removedAt: true, paymentStatus: true },
      });
      if (!current || current.removedAt)
        throw new MoveRefusedError(
          "This student is already removed from the course.",
        );

      const certificate = await tx.certificate.findUnique({
        where: { userId_courseId: { userId, courseId: enrollment.courseId } },
        select: { id: true },
      });
      if (certificate)
        throw new MoveRefusedError(
          "A certificate has been issued for this course, so the student can no longer be moved.",
        );

      const existing = await tx.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
        select: { id: true, removedAt: true },
      });
      if (existing && !existing.removedAt)
        throw new MoveRefusedError(
          `This student is already enrolled in ${destination.title}.`,
        );

      const data = {
        batchId,
        totalDue,
        paymentStatus: current.paymentStatus,
      };
      // Enrollment is unique per (userId, courseId), so an earlier removal from
      // course B must be restored rather than duplicated.
      const moved = existing
        ? await tx.enrollment.update({
            where: { id: existing.id },
            data: { ...data, removedAt: null, removedReason: null },
            select: { id: true },
          })
        : await tx.enrollment.create({
            data: { userId, courseId, ...data },
            select: { id: true },
          });

      await tx.payment.updateMany({
        where: { enrollmentId: id },
        data: { enrollmentId: moved.id },
      });

      await tx.enrollment.update({
        where: { id },
        data: {
          removedAt: new Date(),
          removedReason: `Moved to ${destination.title}`,
        },
      });
    });
  } catch (err) {
    if (err instanceof MoveRefusedError) return { error: err.message };
    console.error("[moveEnrollmentCourse]", err);
    return { error: "A database error occurred. Please try again." };
  }

  revalidateSurfaces(userId, enrollment.courseId);
  revalidateSurfaces(userId, courseId);
  revalidatePath("/admin/courses/" + enrollment.courseId + "/batches");
  revalidatePath("/admin/courses/" + courseId + "/batches");
  return { error: null };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test --run lib/__tests__/enrollments`
Expected: PASS, including the existing `move-batch` and `remove` tests.

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/enrollments/actions.ts lib/__tests__/enrollments/move-course.test.ts
git commit -m "feat(enrollments): move a student to another course with their payments"
```

---

### Task 3: Course picker options and candidate courses

**Files:**
- Create: `lib/enrollments/move-options.ts` (pure, no db import, safe for client components)
- Create: `lib/enrollments/move-targets.ts` (server query)
- Test: `lib/__tests__/enrollments/move-options.test.ts` (create)

**Interfaces:**
- Produces:
  - `type CourseMoveTarget = { id: string; title: string; paymentFrequency: PaymentFrequency | null; batches: { id: string; label: string }[] }`
  - `type CourseMoveOption = CourseMoveTarget & { disabledReason: string | null }`
  - `function courseMoveOptions(targets: CourseMoveTarget[], current: { courseId: string; paymentFrequency: PaymentFrequency | null; activeCourseIds: string[] }): CourseMoveOption[]`
  - `async function getCourseMoveTargets(): Promise<CourseMoveTarget[]>`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/enrollments/move-options.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  courseMoveOptions,
  type CourseMoveTarget,
} from "@/lib/enrollments/move-options";

const batch = { id: "b1", label: "Batch 1" };
const targets: CourseMoveTarget[] = [
  { id: "cA", title: "Marhala 1", paymentFrequency: "ONE_TIME", batches: [batch] },
  { id: "cB", title: "Marhala 2", paymentFrequency: "ONE_TIME", batches: [batch] },
  { id: "cC", title: "Tajweed", paymentFrequency: "MONTHLY", batches: [batch] },
  { id: "cD", title: "Arabic", paymentFrequency: null, batches: [batch] },
  { id: "cE", title: "Fiqh", paymentFrequency: "ONE_TIME", batches: [] },
  { id: "cF", title: "Seerah", paymentFrequency: "ONE_TIME", batches: [batch] },
];

describe("courseMoveOptions", () => {
  const options = courseMoveOptions(targets, {
    courseId: "cA",
    paymentFrequency: "ONE_TIME",
    activeCourseIds: ["cA", "cF"],
  });
  const byId = Object.fromEntries(options.map((o) => [o.id, o]));

  it("drops the current course and courses the student is active in", () => {
    expect(options.map((o) => o.id)).toEqual(["cB", "cC", "cD", "cE"]);
  });

  it("enables a course with the same billing and a batch", () => {
    expect(byId.cB.disabledReason).toBeNull();
  });

  it("disables a course billed differently, null included", () => {
    expect(byId.cC.disabledReason).toBe("Billed differently");
    expect(byId.cD.disabledReason).toBe("Billed differently");
  });

  it("disables a course with no batches", () => {
    expect(byId.cE.disabledReason).toBe("No batches");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test --run lib/__tests__/enrollments/move-options.test.ts`
Expected: FAIL, cannot resolve `@/lib/enrollments/move-options`.

- [ ] **Step 3: Implement the pure helper**

Create `lib/enrollments/move-options.ts`:

```ts
import type { PaymentFrequency } from "@prisma/client";

export type CourseMoveTarget = {
  id: string;
  title: string;
  paymentFrequency: PaymentFrequency | null;
  batches: { id: string; label: string }[];
};

export type CourseMoveOption = CourseMoveTarget & {
  disabledReason: string | null;
};

// The courses an admin may pick when moving one enrollment. Courses the move
// action would refuse stay listed but disabled, so the admin sees why instead
// of wondering where a course went. The action re-checks every rule.
export function courseMoveOptions(
  targets: CourseMoveTarget[],
  current: {
    courseId: string;
    paymentFrequency: PaymentFrequency | null;
    activeCourseIds: string[];
  },
): CourseMoveOption[] {
  return targets
    .filter(
      (t) =>
        t.id !== current.courseId && !current.activeCourseIds.includes(t.id),
    )
    .map((t) => ({
      ...t,
      disabledReason:
        t.paymentFrequency !== current.paymentFrequency
          ? "Billed differently"
          : t.batches.length === 0
            ? "No batches"
            : null,
    }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test --run lib/__tests__/enrollments/move-options.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the query**

Create `lib/enrollments/move-targets.ts`:

```ts
import { db } from "@/lib/db";
import { batchLabel } from "@/lib/batches/name";
import type { CourseMoveTarget } from "@/lib/enrollments/move-options";

// Every course a student could be moved into, with its batches labelled the
// same way the batch move picker labels them. Loaded once per page and
// narrowed per enrollment by courseMoveOptions.
export async function getCourseMoveTargets(): Promise<CourseMoveTarget[]> {
  const courses = await db.course.findMany({
    where: { archivedAt: null },
    orderBy: [
      { groupName: { sort: "asc", nulls: "last" } },
      { level: { sort: "asc", nulls: "last" } },
      { title: "asc" },
    ],
    select: {
      id: true,
      title: true,
      paymentFrequency: true,
      batches: {
        orderBy: { number: "desc" },
        select: { id: true, name: true, number: true, isActive: true },
      },
    },
  });

  return courses.map((c) => ({
    id: c.id,
    title: c.title,
    paymentFrequency: c.paymentFrequency,
    batches: c.batches.map((b) => ({
      id: b.id,
      label: batchLabel(b) + (b.isActive ? " (current intake)" : ""),
    })),
  }));
}
```

Confirm `batchLabel` is exported from `lib/batches/name.ts` (it is re-exported by `lib/batches/queries.ts`). If its parameter type does not accept `{ name, number }`, adjust the select to match it.

- [ ] **Step 6: Typecheck, lint, commit**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors.

```bash
git add lib/enrollments/move-options.ts lib/enrollments/move-targets.ts lib/__tests__/enrollments/move-options.test.ts
git commit -m "feat(enrollments): list the courses a student can be moved into"
```

---

### Task 4: Roster and student profile carry move data

The button needs, per enrollment: course A's `totalDue`, whether a certificate exists, the student's other active course ids, and course A's `paymentFrequency`.

**Files:**
- Modify: `lib/students/queries.ts` (`RosterRow`, `getCourseRoster`, `StudentDetail`, `getStudentById`)
- Modify: `lib/__tests__/enrollments/roster.test.ts`
- Modify: `lib/__tests__/enrollments/admin-visibility.test.ts`

**Interfaces:**
- Produces:
  - `RosterRow` gains `totalDue: number | null`, `hasCertificate: boolean`, `activeCourseIds: string[]`.
  - `StudentDetail['enrollments'][number]` gains `totalDue: number | null`, `hasCertificate: boolean`, `paymentFrequency: PaymentFrequency | null`.

- [ ] **Step 1: Update the tests to the new shapes (failing)**

In `lib/__tests__/enrollments/roster.test.ts`, in the "flattens each enrollment into a roster row" test, change the mocked row and the expectation:

```ts
      {
        id: "e1",
        enrolledAt: new Date("2026-01-05"),
        removedAt: null,
        removedReason: null,
        paymentStatus: "FULLY_PAID",
        totalDue: { toNumber: () => 12000 },
        user: {
          id: "s1",
          firstName: "Sam",
          lastName: "Ali",
          email: "s@example.com",
          certificates: [{ id: "cert1" }],
          enrollments: [{ courseId: "c1" }, { courseId: "c2" }],
        },
      },
```

```ts
    expect(await getCourseRoster("c1")).toEqual([
      {
        enrollmentId: "e1",
        studentId: "s1",
        firstName: "Sam",
        lastName: "Ali",
        email: "s@example.com",
        enrolledAt: new Date("2026-01-05"),
        paymentStatus: "FULLY_PAID",
        removedAt: null,
        removedReason: null,
        totalDue: 12000,
        hasCertificate: true,
        activeCourseIds: ["c1", "c2"],
      },
    ]);
```

Add a test to the same `describe`:

```ts
  it("scopes certificates to this course and enrollments to active ones", async () => {
    await getCourseRoster("c1");
    const arg = vi.mocked(db.enrollment.findMany).mock.calls[0][0]!;
    const user = (arg.select as { user: { select: Record<string, unknown> } })
      .user.select;
    expect(user.certificates).toEqual({
      where: { courseId: "c1" },
      select: { id: true },
    });
    expect(user.enrollments).toEqual({
      where: { removedAt: null },
      select: { courseId: true },
    });
  });
```

In `lib/__tests__/enrollments/admin-visibility.test.ts`:
- Change `enrollmentRow.course` to `{ title: "Marhala 1", paymentFrequency: "ONE_TIME" }` and add `totalDue: null` to `enrollmentRow`.
- In the `getStudentById` test's mocked user, add `certificates: [{ courseId: "c1" }]`.
- Extend its `toMatchObject` with `totalDue: null, hasCertificate: true, paymentFrequency: "ONE_TIME"`.

If `getAllStudents` in that file shares `enrollmentRow`, check the extra fields do not break its assertions; it uses its own select and ignores them.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test --run lib/__tests__/enrollments/roster.test.ts lib/__tests__/enrollments/admin-visibility.test.ts`
Expected: FAIL on the new fields.

- [ ] **Step 3: Implement**

In `lib/students/queries.ts` (single quotes, no semicolons):

Import `PaymentFrequency` alongside the existing Prisma enum imports at the top of the file.

`StudentDetail.enrollments` element type gains:

```ts
    totalDue: number | null
    hasCertificate: boolean
    paymentFrequency: PaymentFrequency | null
```

In `getStudentById`, add `certificates: { select: { courseId: true } },` to the user select, and in the enrollments select add `totalDue: true,` and change `course: { select: { title: true } }` to `course: { select: { title: true, paymentFrequency: true } }`.
In the return, before mapping:

```ts
  const certified = new Set(user.certificates.map((c) => c.courseId))
```

and add to each mapped enrollment:

```ts
      totalDue: e.totalDue?.toNumber() ?? null,
      hasCertificate: certified.has(e.courseId),
      paymentFrequency: e.course.paymentFrequency,
```

`RosterRow` gains:

```ts
  // Null when this enrollment's balance is not tracked.
  totalDue: number | null
  hasCertificate: boolean
  // Courses the student is actively enrolled in, this one included, so the
  // course move picker can leave them out.
  activeCourseIds: string[]
```

In `getCourseRoster`, add `totalDue: true,` to the select and extend the user select:

```ts
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          certificates: { where: { courseId }, select: { id: true } },
          enrollments: { where: { removedAt: null }, select: { courseId: true } },
        },
      },
```

and add to each mapped row:

```ts
    totalDue: e.totalDue?.toNumber() ?? null,
    hasCertificate: e.user.certificates.length > 0,
    activeCourseIds: e.user.enrollments.map((x) => x.courseId),
```

- [ ] **Step 4: Run to verify they pass, then the whole suite**

Run: `pnpm test --run`
Expected: PASS. Any other test that mocks `getCourseRoster` or `getStudentById` output and now fails on missing fields gets the same fields added to its mock.

- [ ] **Step 5: Typecheck, lint, commit**

Run: `pnpm exec tsc --noEmit && pnpm lint`

```bash
git add lib/students/queries.ts lib/__tests__/enrollments/roster.test.ts lib/__tests__/enrollments/admin-visibility.test.ts
git commit -m "feat(students): expose balance, certificate and active courses for course moves"
```

---

### Task 5: Move-course dialog wired into roster and student profile

**Files:**
- Create: `components/admin/move-enrollment-course-button.tsx`
- Modify: `app/(admin)/admin/courses/[id]/course-roster.tsx`
- Modify: `app/(admin)/admin/students/[id]/page.tsx`

**Interfaces:**
- Consumes: `moveEnrollmentCourseAction` (Task 2), `CourseMoveOption`, `courseMoveOptions` (Task 3), `getCourseMoveTargets` (Task 3), new `RosterRow` / `StudentDetail` fields (Task 4).
- Produces: `MoveEnrollmentCourseButton` with props `{ enrollmentId: string; studentName: string; courseTitle: string; totalDue: number | null; courses: CourseMoveOption[] }`.

- [ ] **Step 1: Create the component**

Create `components/admin/move-enrollment-course-button.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useActionState } from "react";
import { moveEnrollmentCourseAction } from "@/lib/enrollments/actions";
import type { CourseMoveOption } from "@/lib/enrollments/move-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/components/ui/alert-dialog";

type Props = {
  enrollmentId: string;
  studentName: string;
  courseTitle: string;
  // Course A's agreed total, pre-filled so a same-price move is one click.
  totalDue: number | null;
  // Already narrowed by courseMoveOptions for this enrollment.
  courses: CourseMoveOption[];
};

export function MoveEnrollmentCourseButton({
  enrollmentId,
  studentName,
  courseTitle,
  totalDue,
  courses,
}: Props) {
  const [state, action, isMoving] = useActionState(
    moveEnrollmentCourseAction,
    { error: null },
  );
  const [courseId, setCourseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [total, setTotal] = useState("");

  if (courses.length === 0) return null;

  const formId = `move-course-${enrollmentId}`;
  const selected = courses.find((c) => c.id === courseId);
  const isMonthly = selected?.paymentFrequency === "MONTHLY";

  return (
    <>
      {/* AlertDialogContent portals into document.body, outside this form, so
          the fields and the confirm button reach it through form={formId}.
          Same constraint as MoveEnrollmentButton - do not remove. */}
      <form action={action} id={formId}>
        <input type="hidden" name="enrollmentId" value={enrollmentId} />
      </form>
      {/* Reset on open, not on close, for the reason MoveEnrollmentButton
          documents: clearing on close disables the confirm button before the
          browser submits the form. */}
      <AlertDialog
        onOpenChange={(open) => {
          if (!open) return;
          setCourseId("");
          setBatchId("");
          setTotal(totalDue === null ? "" : String(totalDue));
        }}
      >
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isMoving}
            aria-label={`Move ${studentName} to another course`}
          >
            {isMoving ? "Changing..." : "Change course"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Move {studentName} to another course
            </AlertDialogTitle>
            <AlertDialogDescription>
              Their payments move with them and they are removed from{" "}
              {courseTitle}. Progress in {courseTitle} does not carry over.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${formId}-course`}>Course</Label>
              <Select
                value={courseId}
                onValueChange={(v) => {
                  setCourseId(v);
                  setBatchId("");
                }}
              >
                <SelectTrigger id={`${formId}-course`} className="w-full">
                  <SelectValue placeholder="Choose a course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem
                      key={c.id}
                      value={c.id}
                      disabled={c.disabledReason !== null}
                    >
                      {c.title}
                      {c.disabledReason && ` - ${c.disabledReason}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                type="hidden"
                name="courseId"
                form={formId}
                value={courseId}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${formId}-batch`}>Batch</Label>
              <Select
                value={batchId}
                onValueChange={setBatchId}
                disabled={!selected}
              >
                <SelectTrigger id={`${formId}-batch`} className="w-full">
                  <SelectValue placeholder="Choose a batch" />
                </SelectTrigger>
                <SelectContent>
                  {selected?.batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                type="hidden"
                name="batchId"
                form={formId}
                value={batchId}
              />
            </div>
            {/* Monthly courses track a per-month ledger, not a single total. */}
            {selected && !isMonthly && (
              <div className="space-y-2">
                <Label htmlFor={`${formId}-total`}>Total due</Label>
                <Input
                  id={`${formId}-total`}
                  name="totalDue"
                  form={formId}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Leave empty to not track a balance"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                />
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="submit"
              form={formId}
              disabled={!courseId || !batchId}
            >
              Move
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {state.error && (
        <p className="text-destructive mt-1 text-xs">{state.error}</p>
      )}
    </>
  );
}
```

- [ ] **Step 2: Wire into the course roster**

In `app/(admin)/admin/courses/[id]/course-roster.tsx`:

Add imports:

```tsx
import { MoveEnrollmentCourseButton } from "@/components/admin/move-enrollment-course-button";
import { getCourseMoveTargets } from "@/lib/enrollments/move-targets";
import { courseMoveOptions } from "@/lib/enrollments/move-options";
```

Extend the `Promise.all` with `getCourseMoveTargets()` as a fourth entry named `moveTargets`, then below `batchOptions`:

```tsx
  // The roster only renders for live courses, which getCourseMoveTargets
  // always includes, so this lookup finds the current course.
  const paymentFrequency =
    moveTargets.find((t) => t.id === courseId)?.paymentFrequency ?? null;
```

Inside the actions cell, directly after the existing `{!r.removedAt && (<MoveEnrollmentButton ... />)}` block:

```tsx
                      {!r.removedAt && !r.hasCertificate && (
                        <MoveEnrollmentCourseButton
                          enrollmentId={r.enrollmentId}
                          studentName={`${r.firstName} ${r.lastName}`}
                          courseTitle={courseTitle}
                          totalDue={r.totalDue}
                          courses={courseMoveOptions(moveTargets, {
                            courseId,
                            paymentFrequency,
                            activeCourseIds: r.activeCourseIds,
                          })}
                        />
                      )}
```

- [ ] **Step 3: Wire into the student profile**

In `app/(admin)/admin/students/[id]/page.tsx` (single quotes, no semicolons):

Add imports:

```tsx
import { MoveEnrollmentCourseButton } from '@/components/admin/move-enrollment-course-button'
import { getCourseMoveTargets } from '@/lib/enrollments/move-targets'
import { courseMoveOptions } from '@/lib/enrollments/move-options'
```

Replace the single student load with:

```tsx
  const [student, moveTargets] = await Promise.all([
    getStudentById(id),
    getCourseMoveTargets(),
  ])
  if (!student) notFound()

  const activeCourseIds = student.enrollments
    .filter((e) => !e.removedAt)
    .map((e) => e.courseId)
```

Replace the actions cell content (currently only `<RemoveEnrollmentButton ... />`) with:

```tsx
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {!e.removedAt && !e.hasCertificate && (
                            <MoveEnrollmentCourseButton
                              enrollmentId={e.id}
                              studentName={`${student.firstName} ${student.lastName}`}
                              courseTitle={e.courseTitle}
                              totalDue={e.totalDue}
                              courses={courseMoveOptions(moveTargets, {
                                courseId: e.courseId,
                                paymentFrequency: e.paymentFrequency,
                                activeCourseIds,
                              })}
                            />
                          )}
                          <RemoveEnrollmentButton
                            enrollmentId={e.id}
                            studentName={`${student.firstName} ${student.lastName}`}
                            courseTitle={e.courseTitle}
                            isRemoved={e.removedAt !== null}
                          />
                        </div>
                      </td>
```

This matches the roster's `flex justify-end gap-2` actions layout.

- [ ] **Step 4: Typecheck, lint, full test suite**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test --run`
Expected: all clean.

- [ ] **Step 5: End-to-end check in the running app**

Follow the E2E screenshot workflow (repo-root throwaway `.tmp-move-e2e.ts`, run with `pnpm exec tsx --env-file=.env`, session cookie minted with `signToken` for the super admin account, project `playwright` package, dev server on :3000; check `ss -ltnp` before starting one).

Do not move a real student. The script must:
1. Create fixtures: a student user with a unique email `move-e2e-<timestamp>@example.com`; two non-archived `ONE_TIME` courses (`E2E Level 1`, `E2E Level 2`), each with one batch; an enrollment in Level 1 with `totalDue: 12000`; one `APPROVED` payment of 5000 on it.
2. Open `/admin/students/<id>`, screenshot the enrollments table at 1280px and 390px widths, and check that the "Change course" button sits neatly beside "Remove".
3. Click "Change course", screenshot the dialog, pick `E2E Level 2` and its batch, confirm the total is pre-filled with `12000`, and submit.
4. Screenshot the profile again: Level 1 shows "Removed - Moved to E2E Level 2", and Level 2 is active.
5. Query the db: the payment's `enrollmentId` is the Level 2 enrollment, and `computeBalance` gives 5000 paid of 12000.
6. Delete every fixture row it created (payment, enrollments, batches, courses, user), then delete the script.

Inspect every screenshot. Fix anything that looks off (alignment, wrapping, truncation, dark mode) before continuing.

- [ ] **Step 6: Commit**

```bash
git add components/admin/move-enrollment-course-button.tsx "app/(admin)/admin/courses/[id]/course-roster.tsx" "app/(admin)/admin/students/[id]/page.tsx"
git commit -m "feat(admin): change a student's course from the roster and student profile"
```
