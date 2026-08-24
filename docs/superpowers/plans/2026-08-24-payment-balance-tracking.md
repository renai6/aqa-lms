# Payment Balance Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every enrollment an admin-set total owed and make approved `Payment` rows the single ledger of money received, so the remaining balance is computed rather than remembered.

**Architecture:** `Enrollment.totalDue` stores the agreed total as a snapshot taken at approval time.
Every peso received against that enrollment becomes an `APPROVED` `Payment` row, including the one paid at checkout, which is written when an admin approves the purchase.
Balance is then `totalDue - sum(approved payments)`, computed by one pure function that every admin and student surface calls.

**Tech Stack:** Next.js App Router (server components and server actions), Prisma with PostgreSQL, Zod for input parsing, vitest with `@/lib/db` mocked, Tailwind with shadcn/ui primitives.

**Spec:** `docs/superpowers/specs/2026-08-24-payment-balance-tracking-design.md`

## Global Constraints

- Package manager is **pnpm**. Never `npm` or `yarn`.
- Money is `Decimal` in Prisma and `number` at every application boundary. Convert with `.toNumber()` in query modules, exactly as `lib/purchases/queries.ts` already does.
- Currency renders as `₱` followed by `value.toLocaleString("en-PH")`, matching `app/(admin)/admin/purchases/[id]/page.tsx:60`.
- There are no component tests in this repo and vitest runs with `environment: 'node'`. Keep all testable logic in pure functions under `lib/`; keep `.tsx` files thin. Do not add jsdom or a new test environment.
- Tests mock `@/lib/db`. There is no test database.
- vitest does NOT typecheck. A green test run is not proof the code compiles. Every task must run `./node_modules/.bin/tsc --noEmit` before committing, not just the test command.
- Do not run `pnpm prisma migrate dev` yourself. The user runs migrations in their own terminal. See Task 1.
- No em dashes in code, comments, copy, or commit messages. Use a plain dash.
- Never add a co-author trailer or a "generated with" line to commit messages.
- The repo is NOT fully prettier-formatted, and `pnpm format` runs `prettier --write .` across everything, which rewrites 230+ unrelated files including generated output and docs. Never run it. Format only the files your task touched: `pnpm prettier --write <path> <path>`.

---

## File Structure

**Created:**
- `lib/purchases/allocation.ts` - pure split of one `amountPaid` across the courses in a purchase.
- `lib/payments/balance.ts` - pure balance computation and its display string.
- `components/admin/balance-summary.tsx` - thin presentational wrapper over `describeBalance`.
- `lib/__tests__/purchases/allocation.test.ts`
- `lib/__tests__/payments/balance.test.ts`
- `lib/__tests__/purchases/approve-allocation.test.ts`
- `lib/__tests__/payments/queries.test.ts`

**Modified:**
- `prisma/schema.prisma` - `PaymentSource` enum, `Enrollment.totalDue`, `Payment.source`, `Payment.purchaseId`.
- `app/(admin)/admin/purchases/[id]/actions.ts` - approval accepts per-course totals and applied amounts, writes `totalDue` and one `CHECKOUT` payment row per new enrollment.
- `app/(admin)/admin/purchases/[id]/approve-form.tsx` - grows from a bare button to a per-course table.
- `app/(admin)/admin/purchases/[id]/page.tsx` - passes course rows and the allocation prefill into the form.
- `lib/purchases/queries.ts` - purchase detail selects `paymentFrequency`.
- `lib/payments/queries.ts` - queue and counts filter to `SUBMITTED`; detail and queue return balance inputs.
- `app/(admin)/admin/payments/page.tsx` - Balance column.
- `app/(admin)/admin/payments/[id]/page.tsx` - balance summary before and after.
- `app/(admin)/admin/payments/[id]/approve-form.tsx` - status default from balance, plus catch-up fields when untracked.
- `app/(admin)/admin/payments/[id]/actions.ts` - writes `totalDue` and the catch-up row.
- `app/(student)/student/dashboard/page.tsx` - real balance line.
- `app/(student)/student/payments/[enrollmentId]/page.tsx` - balance above the form.
- `lib/__tests__/payments/approve.test.ts` - extended for the catch-up path.

---

### Task 1: Schema and migration

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: nothing.
- Produces: `PaymentSource` enum with members `SUBMITTED` and `CHECKOUT`; `Enrollment.totalDue: Decimal | null`; `Payment.source: PaymentSource`; `Payment.purchaseId: string | null`; `Purchase.payments: Payment[]`.

This task has no test cycle of its own because mocked tests cannot observe schema.
Its gate is that the generated Prisma client typechecks.

- [ ] **Step 1: Add the PaymentSource enum**

In `prisma/schema.prisma`, next to the other enums (near `PaymentStatus` at line 69):

```prisma
// Whether a Payment row is something a student submitted for review, or a
// record of money an admin logged (the checkout payment, or a catch-up row
// written when an existing enrollment starts being balance-tracked).
// The admin review queue shows only SUBMITTED rows.
enum PaymentSource {
  SUBMITTED
  CHECKOUT
}
```

- [ ] **Step 2: Add totalDue to Enrollment**

In `model Enrollment`, after the `paymentStatus` line:

```prisma
  // The agreed total for this enrollment, snapshotted when an admin sets it.
  // Null means this enrollment's balance is not tracked, which is how every
  // enrollment created before this feature behaves.
  totalDue Decimal?
```

- [ ] **Step 3: Add source and purchaseId to Payment**

In `model Payment`, after the `status` line:

```prisma
  source     PaymentSource @default(SUBMITTED)
  // Which purchase this money arrived with, when it arrived with one. Null for
  // student submissions and for enrollments created without a purchase.
  purchaseId String?
  purchase   Purchase?     @relation(fields: [purchaseId], references: [id])
```

and add to the index block at the bottom of the model:

```prisma
  @@index([purchaseId])
  @@index([source, status])
```

- [ ] **Step 4: Add the back-relation on Purchase**

In `model Purchase`, after the `enrollments Enrollment[]` line:

```prisma
  payments Payment[]
```

- [ ] **Step 5: Ask the user to run the migration**

Stop and tell the user, verbatim:

> Schema updated. Please run this in your terminal, then tell me when it is done:
>
> `pnpm prisma migrate dev --name add_payment_balance`

Do not run it yourself, and do not substitute `migrate deploy`, which will not create the migration.
If the command reports drift or offers a reset, that means the branch is behind `origin/main`. It is not a database problem, and the answer is never to accept the reset.

- [ ] **Step 6: Regenerate the client and typecheck**

Run: `pnpm prisma generate && ./node_modules/.bin/tsc --noEmit`
Expected: no errors. This is the only proof the new columns exist.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add balance columns to enrollment and payment

Adds Enrollment.totalDue, plus Payment.source and Payment.purchaseId, so
approved payments can serve as the single ledger of money received."
```

---

### Task 2: The allocation function

**Files:**
- Create: `lib/purchases/allocation.ts`
- Test: `lib/__tests__/purchases/allocation.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `allocate(amountPaid: number, fees: (number | null)[]): number[]` - returns one share per fee, in the same order, always summing to exactly `amountPaid`.

Why the shares must reconcile exactly: the result prefills a form whose submitted values are validated against `amountPaid` in Task 5.
A prefill that fails its own validation would block every multi-course approval.

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/purchases/allocation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { allocate } from "@/lib/purchases/allocation";

describe("allocate", () => {
  it("gives a single course the whole amount", () => {
    expect(allocate(5000, [20000])).toEqual([5000]);
  });

  it("splits proportionally by fee", () => {
    expect(allocate(3000, [10000, 20000])).toEqual([1000, 2000]);
  });

  it("splits evenly when any fee is missing", () => {
    expect(allocate(3000, [10000, null])).toEqual([1500, 1500]);
  });

  it("splits evenly when every fee is zero", () => {
    expect(allocate(1000, [0, 0])).toEqual([500, 500]);
  });

  // The shares prefill a form that is validated to sum to amountPaid, so a
  // split that loses a centavo to rounding would make the prefill unusable.
  it("reconciles exactly when the division does not come out round", () => {
    const shares = allocate(1000, [10000, 20000, 30000]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it("gives the rounding remainder to the highest-fee course", () => {
    expect(allocate(1000, [10000, 20000, 30000])).toEqual([
      166.67, 333.33, 500,
    ]);
  });

  it("returns an empty array for no courses", () => {
    expect(allocate(1000, [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/__tests__/purchases/allocation.test.ts`
Expected: FAIL, cannot resolve `@/lib/purchases/allocation`.

- [ ] **Step 3: Write the implementation**

Create `lib/purchases/allocation.ts`:

```ts
// Splits one purchase's amountPaid across its courses, so each resulting
// enrollment gets its own share of the money as a ledger row.
//
// This is a prefill for an admin-editable form, not a claim about which course
// the student meant the money for. The admin overrides it when a student
// earmarks payment for one course.
//
// The shares always sum to exactly `amountPaid`: the approval action validates
// that, so a split that lost a centavo to rounding would block the approval it
// was meant to prefill.
export function allocate(amountPaid: number, fees: (number | null)[]): number[] {
  if (fees.length === 0) return [];

  const total = fees.reduce<number>((sum, fee) => sum + (fee ?? 0), 0);
  // Proportional needs every fee known and a non-zero total to divide by.
  // Otherwise there is no basis for weighting, so weight them equally.
  const canWeight = fees.every((fee) => fee !== null) && total > 0;

  const shares = fees.map((fee) =>
    round2(canWeight ? (amountPaid * (fee as number)) / total : amountPaid / fees.length),
  );

  // Rounding each share independently leaves a few centavos over or short.
  // Give the difference to the largest share, where it is proportionally
  // least visible, and the total reconciles exactly.
  const drift = round2(amountPaid - shares.reduce((a, b) => a + b, 0));
  if (drift !== 0) {
    const largest = shares.reduce(
      (best, share, i) => (share > shares[best] ? i : best),
      0,
    );
    shares[largest] = round2(shares[largest] + drift);
  }

  return shares;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/__tests__/purchases/allocation.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/purchases/allocation.ts lib/__tests__/purchases/allocation.test.ts
git commit -m "feat: add proportional allocation of a purchase amount across courses"
```

---

### Task 3: The balance function

**Files:**
- Create: `lib/payments/balance.ts`
- Test: `lib/__tests__/payments/balance.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Balance = { kind: "untracked" } | { kind: "tracked"; totalDue: number; paid: number; remaining: number }`
  - `computeBalance(totalDue: number | null, approvedAmounts: number[]): Balance`
  - `describeBalance(balance: Balance): string`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/payments/balance.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeBalance, describeBalance } from "@/lib/payments/balance";

describe("computeBalance", () => {
  it("is untracked when no total has been agreed", () => {
    expect(computeBalance(null, [5000])).toEqual({ kind: "untracked" });
  });

  it("subtracts approved payments from the total", () => {
    expect(computeBalance(20000, [5000, 3000])).toEqual({
      kind: "tracked",
      totalDue: 20000,
      paid: 8000,
      remaining: 12000,
    });
  });

  // Assert the whole object, not `.remaining`: Balance is a discriminated
  // union and TypeScript cannot narrow a property off the bare return value,
  // so `computeBalance(...).remaining` fails `tsc --noEmit` even though it
  // runs fine under vitest.
  it("reports zero remaining when settled exactly", () => {
    expect(computeBalance(20000, [20000])).toEqual({
      kind: "tracked",
      totalDue: 20000,
      paid: 20000,
      remaining: 0,
    });
  });

  // Not clamped: an admin needs to see that a student sent too much, because
  // the resolution is a refund or a credit, not a silent zero.
  it("reports a negative remainder when the student overpaid", () => {
    expect(computeBalance(20000, [20500])).toEqual({
      kind: "tracked",
      totalDue: 20000,
      paid: 20500,
      remaining: -500,
    });
  });

  it("treats no payments as nothing paid", () => {
    expect(computeBalance(20000, [])).toEqual({
      kind: "tracked",
      totalDue: 20000,
      paid: 0,
      remaining: 20000,
    });
  });
});

describe("describeBalance", () => {
  it("says nothing numeric when untracked", () => {
    expect(describeBalance({ kind: "untracked" })).toBe("Balance not tracked");
  });

  it("states paid and remaining", () => {
    expect(describeBalance(computeBalance(20000, [8000]))).toBe(
      "₱8,000 of ₱20,000 paid. ₱12,000 remaining.",
    );
  });

  it("states fully paid on exact settlement", () => {
    expect(describeBalance(computeBalance(20000, [20000]))).toBe(
      "Fully paid. ₱20,000 of ₱20,000.",
    );
  });

  it("states the overpaid amount", () => {
    expect(describeBalance(computeBalance(20000, [20500]))).toBe(
      "Overpaid by ₱500.",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/__tests__/payments/balance.test.ts`
Expected: FAIL, cannot resolve `@/lib/payments/balance`.

- [ ] **Step 3: Write the implementation**

Create `lib/payments/balance.ts`:

```ts
// The one place a balance is computed. Every admin and student surface calls
// this rather than doing its own arithmetic, so they cannot disagree.
export type Balance =
  | { kind: "untracked" }
  | { kind: "tracked"; totalDue: number; paid: number; remaining: number };

// `approvedAmounts` must already be filtered to APPROVED rows. Pending and
// rejected payments are not money received and never move a balance.
export function computeBalance(
  totalDue: number | null,
  approvedAmounts: number[],
): Balance {
  if (totalDue === null) return { kind: "untracked" };
  const paid = approvedAmounts.reduce((sum, amount) => sum + amount, 0);
  // Deliberately not clamped at zero: an overpayment needs to be visible.
  return { kind: "tracked", totalDue, paid, remaining: totalDue - paid };
}

export function describeBalance(balance: Balance): string {
  if (balance.kind === "untracked") return "Balance not tracked";
  const { totalDue, paid, remaining } = balance;
  if (remaining < 0) return `Overpaid by ${peso(-remaining)}.`;
  if (remaining === 0) return `Fully paid. ${peso(paid)} of ${peso(totalDue)}.`;
  return `${peso(paid)} of ${peso(totalDue)} paid. ${peso(remaining)} remaining.`;
}

function peso(amount: number): string {
  return `₱${amount.toLocaleString("en-PH")}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/__tests__/payments/balance.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Add the presentational wrapper**

Create `components/admin/balance-summary.tsx`.
All the logic lives in `describeBalance`, so this stays a thin wrapper and needs no test.

```tsx
import { describeBalance, type Balance } from "@/lib/payments/balance";

export function BalanceSummary({
  balance,
  label = "Balance",
}: {
  balance: Balance;
  label?: string;
}) {
  const tone =
    balance.kind === "untracked"
      ? "text-muted-foreground"
      : balance.remaining > 0
        ? "text-amber-600"
        : balance.remaining < 0
          ? "text-destructive"
          : "text-green-700";

  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${tone}`}>{describeBalance(balance)}</span>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
# format only this task's files, never `pnpm format`
git add lib/payments/balance.ts lib/__tests__/payments/balance.test.ts components/admin/balance-summary.tsx
git commit -m "feat: add balance computation and its admin summary component"
```

---

### Task 4: Purchase approval writes totals and ledger rows

**Files:**
- Modify: `app/(admin)/admin/purchases/[id]/actions.ts:38-136`
- Test: `lib/__tests__/purchases/approve-allocation.test.ts`

**Interfaces:**
- Consumes: `allocate` from Task 2.
- Produces: `approvePurchaseAction` now reads two repeated form fields per course, `totalDue_<courseId>` and `applied_<courseId>`.

The form that submits those fields comes in Task 5.
Doing the action first means Task 5 has a tested contract to build against.

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/purchases/approve-allocation.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    purchase: { findUnique: vi.fn(), updateMany: vi.fn() },
    enrollment: { findUnique: vi.fn(), create: vi.fn() },
    payment: { create: vi.fn() },
    batch: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("@/lib/purchases/email", () => ({
  sendPurchaseApprovalEmail: vi.fn(),
  sendPurchaseRejectionEmail: vi.fn(),
}));

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { approvePurchaseAction } from "@/app/(admin)/admin/purchases/[id]/actions";

// A double distinct from `db`, so assertions prove the writes happened inside
// the transaction callback rather than on `db` directly.
let tx: {
  purchase: { updateMany: ReturnType<typeof vi.fn> };
  enrollment: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  payment: { create: ReturnType<typeof vi.fn> };
  batch: { findFirst: ReturnType<typeof vi.fn> };
};

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const twoCoursePurchase = {
  paymentType: "PARTIAL",
  amountPaid: { toNumber: () => 3000 },
  paymentProofUrl: "purchase/p1/proof.jpg",
  user: { id: "u1", email: "s@example.com", firstName: "Sam" },
  items: [
    { courseId: "c1", course: { title: "Marhala 1", archivedAt: null } },
    { courseId: "c2", course: { title: "Marhala 2", archivedAt: null } },
  ],
};

describe("approvePurchaseAction records totals and ledger rows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      userId: "admin1",
      role: "ADMIN",
    } as never);

    tx = {
      purchase: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      enrollment: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi
          .fn()
          .mockImplementation(({ data }: { data: { courseId: string } }) =>
            Promise.resolve({ id: `e-${data.courseId}` }),
          ),
      },
      payment: { create: vi.fn().mockResolvedValue({ id: "pay1" }) },
      batch: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    vi.mocked(db.$transaction).mockImplementation(
      ((cb: (t: unknown) => unknown) => cb(tx)) as unknown as typeof db.$transaction,
    );
    vi.mocked(db.purchase.findUnique).mockResolvedValue(twoCoursePurchase as never);
  });

  it("writes the entered total onto each new enrollment", async () => {
    await expect(
      approvePurchaseAction(
        { error: null },
        form({
          id: "p1",
          totalDue_c1: "10000",
          applied_c1: "1000",
          totalDue_c2: "20000",
          applied_c2: "2000",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(tx.enrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ courseId: "c1", totalDue: 10000 }),
      }),
    );
  });

  it("creates one approved CHECKOUT payment per enrollment", async () => {
    await expect(
      approvePurchaseAction(
        { error: null },
        form({
          id: "p1",
          totalDue_c1: "10000",
          applied_c1: "1000",
          totalDue_c2: "20000",
          applied_c2: "2000",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(tx.payment.create).toHaveBeenCalledTimes(2);
    expect(tx.payment.create).toHaveBeenCalledWith({
      data: {
        enrollmentId: "e-c1",
        purchaseId: "p1",
        amount: 1000,
        proofUrl: "purchase/p1/proof.jpg",
        status: "APPROVED",
        source: "CHECKOUT",
        reviewedById: "admin1",
        reviewedAt: expect.any(Date),
      },
    });
  });

  it("leaves totalDue null when the admin leaves the total blank", async () => {
    await expect(
      approvePurchaseAction(
        { error: null },
        form({
          id: "p1",
          totalDue_c1: "",
          applied_c1: "1000",
          totalDue_c2: "",
          applied_c2: "2000",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(tx.enrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ courseId: "c1", totalDue: null }),
      }),
    );
  });

  // Accepting a split that does not reconcile would leave the ledger
  // permanently out of step with the money actually received.
  it("refuses approval when the applied amounts do not sum to amountPaid", async () => {
    const result = await approvePurchaseAction(
      { error: null },
      form({
        id: "p1",
        totalDue_c1: "10000",
        applied_c1: "1000",
        totalDue_c2: "20000",
        applied_c2: "1500",
      }),
    );

    expect(result.error).toContain("₱2,500");
    expect(result.error).toContain("₱3,000");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  // A re-purchase of a course the student already has must not add money to
  // an existing balance, or the student appears to owe less than they do.
  it("creates no payment row for a course the student is already enrolled in", async () => {
    tx.enrollment.findUnique.mockImplementation(
      ({ where }: { where: { userId_courseId: { courseId: string } } }) =>
        Promise.resolve(
          where.userId_courseId.courseId === "c1" ? { id: "existing" } : null,
        ),
    );

    await expect(
      approvePurchaseAction(
        { error: null },
        form({
          id: "p1",
          totalDue_c1: "10000",
          applied_c1: "1000",
          totalDue_c2: "20000",
          applied_c2: "2000",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(tx.payment.create).toHaveBeenCalledTimes(1);
    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ enrollmentId: "e-c2" }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/__tests__/purchases/approve-allocation.test.ts`
Expected: FAIL. `amountPaid` and `paymentProofUrl` are not selected by the action yet, and no payment rows are created.

- [ ] **Step 3: Select the fields the action now needs**

In `app/(admin)/admin/purchases/[id]/actions.ts`, extend the `db.purchase.findUnique` select at line 48 to add `amountPaid: true` and `paymentProofUrl: true` alongside `paymentType: true`.

- [ ] **Step 4: Parse and validate the per-course fields**

In `approvePurchaseAction`, after the `if (!purchase) return { error: "Purchase not found." };` line, insert:

```ts
  // The approve form submits one pair of fields per course. Blank totalDue is
  // meaningful: it means "do not track this enrollment's balance", which is
  // how every enrollment behaved before balances existed.
  const entries = purchase.items.map((item) => {
    const rawTotal = formData.get(`totalDue_${item.courseId}`);
    const rawApplied = formData.get(`applied_${item.courseId}`);
    const total = typeof rawTotal === "string" ? rawTotal.trim() : "";
    const applied = typeof rawApplied === "string" ? rawApplied.trim() : "";
    return {
      courseId: item.courseId,
      totalDue: total === "" ? null : Number(total),
      applied: applied === "" ? 0 : Number(applied),
    };
  });

  if (
    entries.some(
      (e) =>
        !Number.isFinite(e.applied) ||
        e.applied < 0 ||
        (e.totalDue !== null && (!Number.isFinite(e.totalDue) || e.totalDue < 0)),
    )
  ) {
    return { error: "Amounts must be zero or a positive number." };
  }

  const amountPaid = purchase.amountPaid.toNumber();
  const appliedTotal =
    Math.round(entries.reduce((sum, e) => sum + e.applied, 0) * 100) / 100;
  if (appliedTotal !== amountPaid) {
    return {
      error: `Applied amounts total ₱${appliedTotal.toLocaleString("en-PH")}, but the student paid ₱${amountPaid.toLocaleString("en-PH")}. Adjust them so they match.`,
    };
  }
```

- [ ] **Step 5: Write totalDue and the ledger row inside the transaction**

In the same file, inside the `for (const item of purchase.items)` loop, replace only the `await tx.enrollment.create({ ... })` call (currently at line 94) with the block below.
Leave the `if (exists) continue;` guard and the `activeBatch` lookup above it exactly as they are: that guard is what makes the last test pass.

```ts
        const entry = entries.find((e) => e.courseId === item.courseId)!;
        const enrollment = await tx.enrollment.create({
          data: {
            userId: purchase.user.id,
            courseId: item.courseId,
            paymentStatus,
            purchaseId: id,
            batchId: activeBatch?.id ?? null,
            totalDue: entry.totalDue,
          },
        });

        // The checkout payment enters the ledger here, so every peso received
        // for this enrollment lives in one table. The proof URL is reused
        // rather than copied, so no second file is stored.
        await tx.payment.create({
          data: {
            enrollmentId: enrollment.id,
            purchaseId: id,
            amount: entry.applied,
            proofUrl: purchase.paymentProofUrl,
            status: "APPROVED",
            source: "CHECKOUT",
            reviewedById: auth.userId,
            reviewedAt: new Date(),
          },
        });
```

The existing `if (exists) continue;` above it already skips both writes for a course the student is enrolled in, which is what the last test asserts.

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run lib/__tests__/purchases/approve-allocation.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Run the whole suite**

Run: `pnpm vitest run`
Expected: PASS. `approve-archived-course.test.ts` passes an empty form, so its purchase mock needs `amountPaid: { toNumber: () => 0 }` and `paymentProofUrl: ""` added for the new select. Add them if that test fails.

- [ ] **Step 8: Commit**

```bash
git add app/\(admin\)/admin/purchases/\[id\]/actions.ts lib/__tests__/purchases/
git commit -m "feat: record per-enrollment totals and checkout payments on purchase approval"
```

---

### Task 5: The purchase approve form

**Files:**
- Modify: `app/(admin)/admin/purchases/[id]/approve-form.tsx`
- Modify: `app/(admin)/admin/purchases/[id]/page.tsx:97-105`
- Modify: `lib/purchases/queries.ts:133-176`

**Interfaces:**
- Consumes: `allocate` from Task 2; the `totalDue_<courseId>` and `applied_<courseId>` contract from Task 4.
- Produces: `ApproveForm` takes `{ id: string; courses: ApproveCourse[]; amountPaid: number }` where `ApproveCourse` is `{ id: string; title: string; tuitionFee: number | null; paymentFrequency: PaymentFrequency | null }`.

- [ ] **Step 1: Add paymentFrequency to the purchase detail query**

In `lib/purchases/queries.ts`, add `paymentFrequency: PaymentFrequency | null` to the `courses` member of `AdminPurchaseDetail`, select `paymentFrequency: true` inside the `items.course` select, and map it through.
`PaymentFrequency` is already imported by this file's sibling type at line 17.

- [ ] **Step 2: Rewrite the approve form**

Replace `app/(admin)/admin/purchases/[id]/approve-form.tsx` entirely:

```tsx
"use client";

import { useActionState, useState } from "react";
import type { PaymentFrequency } from "@prisma/client";
import { approvePurchaseAction } from "./actions";
import { allocate } from "@/lib/purchases/allocation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ApproveCourse = {
  id: string;
  title: string;
  tuitionFee: number | null;
  paymentFrequency: PaymentFrequency | null;
};

// Only a fixed-total course has a meaningful lifetime total to prefill.
// Monthly and yearly courses are billed per period, which this feature does
// not model, so their totals start blank and the enrollment stays untracked
// unless an admin types one.
function prefillTotal(course: ApproveCourse): string {
  if (course.tuitionFee === null) return "";
  if (course.paymentFrequency === "MONTHLY" || course.paymentFrequency === "YEARLY") {
    return "";
  }
  return String(course.tuitionFee);
}

export function ApproveForm({
  id,
  courses,
  amountPaid,
}: {
  id: string;
  courses: ApproveCourse[];
  amountPaid: number;
}) {
  const [state, action, isPending] = useActionState(approvePurchaseAction, {
    error: null,
  });

  const prefill = allocate(
    amountPaid,
    courses.map((c) => c.tuitionFee),
  );
  const [applied, setApplied] = useState<string[]>(prefill.map(String));

  const appliedTotal =
    Math.round(
      applied.reduce((sum, value) => sum + (Number(value) || 0), 0) * 100,
    ) / 100;
  const reconciles = appliedTotal === amountPaid;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />

      <div>
        <p className="text-sm font-semibold">Enrollment totals</p>
        <p className="text-muted-foreground text-sm">
          Set what each course costs this student, and how much of the
          ₱{amountPaid.toLocaleString("en-PH")} received applies to each. Leave a
          total blank to skip balance tracking for that course.
        </p>
      </div>

      <div className="space-y-3">
        {courses.map((course, i) => (
          <div key={course.id} className="rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">{course.title}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={`totalDue_${course.id}`}>Total due (₱)</Label>
                <Input
                  id={`totalDue_${course.id}`}
                  name={`totalDue_${course.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={prefillTotal(course)}
                />
              </div>
              <div>
                <Label htmlFor={`applied_${course.id}`}>Amount applied (₱)</Label>
                <Input
                  id={`applied_${course.id}`}
                  name={`applied_${course.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={applied[i] ?? ""}
                  onChange={(e) =>
                    setApplied((prev) =>
                      prev.map((v, j) => (j === i ? e.target.value : v)),
                    )
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {!reconciles && (
        <p className="text-destructive text-sm">
          Applied amounts total ₱{appliedTotal.toLocaleString("en-PH")}, but the
          student paid ₱{amountPaid.toLocaleString("en-PH")}.
        </p>
      )}

      {state.error && <p className="text-destructive text-sm">{state.error}</p>}

      <Button
        type="submit"
        disabled={isPending || !reconciles}
        className="bg-green-600 hover:bg-green-700"
      >
        {isPending ? "Approving…" : "Approve purchase"}
      </Button>
    </form>
  );
}
```

The action re-validates the sum server-side, because disabling a button only stops the honest path.

- [ ] **Step 3: Pass the new props from the page**

In `app/(admin)/admin/purchases/[id]/page.tsx`, change the `<ApproveForm id={purchase.id} />` usage to:

```tsx
          <ApproveForm
            id={purchase.id}
            courses={purchase.courses}
            amountPaid={purchase.amountPaid}
          />
```

- [ ] **Step 4: Typecheck and run the suite**

Run: `./node_modules/.bin/tsc --noEmit && pnpm vitest run && pnpm lint`
Expected: no errors, all tests pass.

- [ ] **Step 5: Verify in the browser**

Run `pnpm dev`, open a pending multi-course purchase at `/admin/purchases/[id]`, and confirm the applied amounts prefill proportionally and sum to the amount paid, that editing one to a wrong value disables the button with the mismatch shown, and that approving succeeds once corrected.

- [ ] **Step 6: Commit**

```bash
# format only this task's files, never `pnpm format`
git add app/\(admin\)/admin/purchases/\[id\]/ lib/purchases/queries.ts
git commit -m "feat: collect per-course totals and payment split on purchase approval"
```

---

### Task 6: Keep checkout rows out of the review queue

**Files:**
- Modify: `lib/payments/queries.ts:69-110`
- Test: `lib/__tests__/payments/queries.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `getAdminPaymentsByStatus` and `getPaymentStatusCounts` both filter `source: "SUBMITTED"`. `AdminPaymentRow` gains `balance: Balance`.

Without this, every checkout payment written by Task 4 appears in the admin queue's Approved tab as an item that was never submitted for review.

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/payments/queries.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { payment: { findMany: vi.fn(), groupBy: vi.fn() } },
}));

import { db } from "@/lib/db";
import {
  getAdminPaymentsByStatus,
  getPaymentStatusCounts,
} from "@/lib/payments/queries";

describe("admin payment queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.payment.findMany).mockResolvedValue([] as never);
    vi.mocked(db.payment.groupBy).mockResolvedValue([] as never);
  });

  // Checkout rows are money already accounted for, not submissions awaiting a
  // decision. A queue that lists them asks the admin to review their own work.
  it("lists only student-submitted payments", async () => {
    await getAdminPaymentsByStatus("APPROVED");
    expect(db.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "APPROVED", source: "SUBMITTED" },
      }),
    );
  });

  it("counts only student-submitted payments, so tabs match their rows", async () => {
    await getPaymentStatusCounts();
    expect(db.payment.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { source: "SUBMITTED" } }),
    );
  });

  it("returns each row's enrollment balance", async () => {
    vi.mocked(db.payment.findMany).mockResolvedValue([
      {
        id: "pay1",
        status: "PENDING",
        amount: { toNumber: () => 5000 },
        createdAt: new Date(),
        enrollment: {
          totalDue: { toNumber: () => 20000 },
          payments: [{ amount: { toNumber: () => 3000 } }],
          user: { firstName: "Sam", lastName: "Lee", email: "s@example.com" },
          course: { title: "Marhala 1" },
        },
      },
    ] as never);

    const rows = await getAdminPaymentsByStatus("PENDING");
    expect(rows[0].balance).toEqual({
      kind: "tracked",
      totalDue: 20000,
      paid: 3000,
      remaining: 17000,
    });
  });

  it("reports an untracked balance when no total is set", async () => {
    vi.mocked(db.payment.findMany).mockResolvedValue([
      {
        id: "pay1",
        status: "PENDING",
        amount: { toNumber: () => 5000 },
        createdAt: new Date(),
        enrollment: {
          totalDue: null,
          payments: [],
          user: { firstName: "Sam", lastName: "Lee", email: "s@example.com" },
          course: { title: "Marhala 1" },
        },
      },
    ] as never);

    const rows = await getAdminPaymentsByStatus("PENDING");
    expect(rows[0].balance).toEqual({ kind: "untracked" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/__tests__/payments/queries.test.ts`
Expected: FAIL. The `where` clause has no `source`, and `balance` is undefined.

- [ ] **Step 3: Update the queue query**

In `lib/payments/queries.ts`, import the balance helpers at the top:

```ts
import { computeBalance, type Balance } from "@/lib/payments/balance";
```

Add `balance: Balance;` to `AdminPaymentRow`.
Then in `getAdminPaymentsByStatus`, change the `where` to `{ status, source: "SUBMITTED" }`, and extend the `enrollment` select to:

```ts
      enrollment: {
        select: {
          totalDue: true,
          // Approved rows only: pending and rejected payments are not money
          // received and must not move the balance.
          payments: {
            where: { status: "APPROVED" },
            select: { amount: true },
          },
          user: { select: { firstName: true, lastName: true, email: true } },
          course: { select: { title: true } },
        },
      },
```

and add to the mapped result:

```ts
    balance: computeBalance(
      r.enrollment.totalDue?.toNumber() ?? null,
      r.enrollment.payments.map((p) => p.amount.toNumber()),
    ),
```

- [ ] **Step 4: Update the counts query**

In `getPaymentStatusCounts`, add the matching filter:

```ts
  const grouped = await db.payment.groupBy({
    by: ["status"],
    where: { source: "SUBMITTED" },
    _count: { _all: true },
  });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run lib/__tests__/payments/queries.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Add the Balance column to the queue page**

In `app/(admin)/admin/payments/page.tsx`, add a `Balance` header cell after the `Amount` header at line 120, copying the sibling headers' classes exactly, and a matching body cell rendering `describeBalance(r.balance)`.
Import it with `import { describeBalance } from "@/lib/payments/balance";`.

- [ ] **Step 7: Typecheck, lint, and commit**

Run: `./node_modules/.bin/tsc --noEmit && pnpm vitest run && pnpm lint`

```bash
# format only this task's files, never `pnpm format`
git add lib/payments/queries.ts lib/__tests__/payments/queries.test.ts app/\(admin\)/admin/payments/page.tsx
git commit -m "feat: filter the payment queue to student submissions and show balances"
```

---

### Task 7: Balance on the payment detail page

**Files:**
- Modify: `lib/payments/queries.ts:113-165`
- Modify: `app/(admin)/admin/payments/[id]/page.tsx`
- Modify: `app/(admin)/admin/payments/[id]/approve-form.tsx`

**Interfaces:**
- Consumes: `computeBalance`, `Balance`, `BalanceSummary`.
- Produces: `AdminPaymentDetail` gains `balance: Balance` (the enrollment as it stands now, excluding this payment) and `balanceIfApproved: Balance`.

- [ ] **Step 1: Extend the detail query**

In `lib/payments/queries.ts`, add to `AdminPaymentDetail`:

```ts
  // The enrollment's balance as it stands now. This payment is PENDING, so it
  // is not in the approved sum and is not counted here.
  balance: Balance;
  // What that balance becomes if this payment is approved.
  balanceIfApproved: Balance;
```

In `getAdminPaymentById`, add `totalDue: true` and the approved-payments select to the `enrollment` select, mirroring Task 6 exactly:

```ts
          totalDue: true,
          payments: {
            where: { status: "APPROVED" },
            select: { amount: true },
          },
```

and in the returned object:

```ts
    balance: computeBalance(totalDue, approvedAmounts),
    balanceIfApproved: computeBalance(totalDue, [...approvedAmounts, amount]),
```

where `totalDue` is `r.enrollment.totalDue?.toNumber() ?? null`, `approvedAmounts` is `r.enrollment.payments.map((p) => p.amount.toNumber())`, and `amount` is `r.amount.toNumber()`.

- [ ] **Step 2: Render both on the detail page**

In `app/(admin)/admin/payments/[id]/page.tsx`, inside the card that currently ends with the "Current enrollment status" row, add below it:

```tsx
        <div className="space-y-1 border-t pt-2">
          <BalanceSummary balance={payment.balance} label="Balance now" />
          {isPending && (
            <BalanceSummary
              balance={payment.balanceIfApproved}
              label="After approving"
            />
          )}
        </div>
```

with `import { BalanceSummary } from "@/components/admin/balance-summary";` at the top.

- [ ] **Step 3: Default the status radio from the balance**

In `app/(admin)/admin/payments/[id]/approve-form.tsx`, change the props to accept `defaultStatus: "PARTIALLY_PAID" | "FULLY_PAID"` in place of `currentStatus`, and use it in both `defaultChecked` expressions.

In `page.tsx`, compute and pass it:

```tsx
          <ApproveForm
            id={payment.id}
            defaultStatus={
              payment.balanceIfApproved.kind === "tracked" &&
              payment.balanceIfApproved.remaining <= 0
                ? "FULLY_PAID"
                : payment.enrollmentPaymentStatus
            }
          />
```

An untracked balance falls back to the enrollment's current status, which is exactly today's behavior.
The radio stays editable either way: a student can settle the last of a balance offline, and the admin is the one who knows.

- [ ] **Step 4: Drop the stale comment in the action**

In `app/(admin)/admin/payments/[id]/actions.ts`, delete the two-line comment above the `paymentStatus` parse that begins "There is no balance math anywhere in this feature".
It is no longer true.
The action still takes the status from the form, so nothing else changes here.

- [ ] **Step 5: Typecheck, test, lint**

Run: `./node_modules/.bin/tsc --noEmit && pnpm vitest run && pnpm lint`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
# format only this task's files, never `pnpm format`
git add lib/payments/queries.ts app/\(admin\)/admin/payments/\[id\]/
git commit -m "feat: show the enrollment balance when reviewing a payment"
```

---

### Task 8: Start tracking an existing enrollment

**Files:**
- Modify: `app/(admin)/admin/payments/[id]/actions.ts:26-105`
- Modify: `app/(admin)/admin/payments/[id]/approve-form.tsx`
- Modify: `app/(admin)/admin/payments/[id]/page.tsx`
- Modify: `lib/payments/queries.ts` (detail query)
- Test: `lib/__tests__/payments/approve.test.ts`

**Interfaces:**
- Consumes: `allocate` from Task 2, `Balance` from Task 3.
- Produces: `approvePaymentAction` additionally reads `totalDue` and `alreadyPaid` from the form when the enrollment is untracked. `AdminPaymentDetail` gains `catchUpPrefill: { totalDue: string; alreadyPaid: string } | null`.

Every enrollment that exists today is untracked, so without this task the feature only ever applies to purchases approved from here on.

- [ ] **Step 1: Write the failing test**

Three edits to `lib/__tests__/payments/approve.test.ts` before the new block:

- Add `create: vi.fn()` to the `payment` member of the `tx` double, in both its type and its `beforeEach` initialization.
- Add `totalDue: "unused"` to the `enrollment` object in the existing `paymentRow` fixture, so the pre-existing tests exercise the tracked path and keep asserting today's behavior.
- Add `payment: { ..., create: vi.fn() }` to the `vi.mock("@/lib/db")` factory.

Then append:

```ts
describe("approvePaymentAction starting to track an untracked enrollment", () => {
  beforeEach(() => {
    vi.mocked(db.payment.findUnique).mockResolvedValue({
      enrollmentId: "e1",
      enrollment: {
        totalDue: null,
        purchaseId: "p1",
        purchase: { paymentProofUrl: "purchase/p1/proof.jpg" },
        course: { title: "Tajweed Basics" },
        user: { email: "s@example.com", firstName: "Sam" },
      },
    } as never);
  });

  it("writes the total and a catch-up ledger row in one transaction", async () => {
    const f = approveForm("pay1", "PARTIALLY_PAID");
    f.set("totalDue", "20000");
    f.set("alreadyPaid", "5000");

    await expect(
      approvePaymentAction({ error: null }, f),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { paymentStatus: "PARTIALLY_PAID", totalDue: 20000 },
    });
    expect(tx.payment.create).toHaveBeenCalledWith({
      data: {
        enrollmentId: "e1",
        purchaseId: "p1",
        amount: 5000,
        proofUrl: "purchase/p1/proof.jpg",
        status: "APPROVED",
        source: "CHECKOUT",
        reviewedById: "admin1",
        reviewedAt: expect.any(Date),
      },
    });
  });

  // Leaving the total blank must keep behaving exactly as it did before
  // balances existed, so an admin who does not want this is never forced into it.
  it("leaves the enrollment untracked when the total is blank", async () => {
    const f = approveForm("pay1", "PARTIALLY_PAID");
    f.set("totalDue", "");
    f.set("alreadyPaid", "");

    await expect(
      approvePaymentAction({ error: null }, f),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { paymentStatus: "PARTIALLY_PAID" },
    });
    expect(tx.payment.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/__tests__/payments/approve.test.ts`
Expected: FAIL. The action neither reads those fields nor creates a catch-up row.

- [ ] **Step 3: Select what the action needs**

In `app/(admin)/admin/payments/[id]/actions.ts`, extend the `db.payment.findUnique` select inside `approvePaymentAction` to:

```ts
      enrollmentId: true,
      enrollment: {
        select: {
          totalDue: true,
          purchaseId: true,
          purchase: { select: { paymentProofUrl: true } },
          course: { select: { title: true } },
          user: { select: { email: true, firstName: true } },
        },
      },
```

- [ ] **Step 4: Parse the catch-up fields**

After the `if (!payment) return { error: "Payment not found." };` line:

```ts
  // Only offered when the enrollment has no total yet. Every enrollment that
  // predates balance tracking is in that state, and this is how it converts
  // to the ledger model, one student at a time, with no bulk migration.
  const isUntracked = payment.enrollment.totalDue === null;
  const rawTotal = formData.get("totalDue");
  const rawAlreadyPaid = formData.get("alreadyPaid");
  const totalText = typeof rawTotal === "string" ? rawTotal.trim() : "";
  const alreadyPaidText =
    typeof rawAlreadyPaid === "string" ? rawAlreadyPaid.trim() : "";

  const catchUp =
    isUntracked && totalText !== ""
      ? {
          totalDue: Number(totalText),
          alreadyPaid: alreadyPaidText === "" ? 0 : Number(alreadyPaidText),
        }
      : null;

  if (
    catchUp &&
    (!Number.isFinite(catchUp.totalDue) ||
      catchUp.totalDue < 0 ||
      !Number.isFinite(catchUp.alreadyPaid) ||
      catchUp.alreadyPaid < 0)
  ) {
    return { error: "Amounts must be zero or a positive number." };
  }
```

- [ ] **Step 5: Write both inside the existing transaction**

Replace the `tx.enrollment.update` call in the transaction with:

```ts
      await tx.enrollment.update({
        where: { id: payment.enrollmentId },
        data: catchUp
          ? { paymentStatus, totalDue: catchUp.totalDue }
          : { paymentStatus },
      });

      if (catchUp) {
        // One row standing for everything received before this payment, so the
        // ledger is complete from here on. purchaseId and proofUrl come from
        // the originating purchase when there is one; source alone keeps the
        // row out of the review queue either way.
        await tx.payment.create({
          data: {
            enrollmentId: payment.enrollmentId,
            purchaseId: payment.enrollment.purchaseId,
            amount: catchUp.alreadyPaid,
            proofUrl: payment.enrollment.purchase?.paymentProofUrl ?? "",
            status: "APPROVED",
            source: "CHECKOUT",
            reviewedById: auth.userId,
            reviewedAt: new Date(),
          },
        });
      }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run lib/__tests__/payments/approve.test.ts`
Expected: PASS, including the pre-existing tests in that file.

- [ ] **Step 7: Supply the prefill from the query**

In `lib/payments/queries.ts`, add to `AdminPaymentDetail`:

```ts
  // Non-null only when the enrollment has no total yet, in which case the
  // approve form offers to start tracking it.
  catchUpPrefill: { totalDue: string; alreadyPaid: string } | null;
```

In `getAdminPaymentById`, select the enrollment's `totalDue`, `course.tuitionFee`, `course.paymentFrequency`, and `purchase: { select: { amountPaid: true, items: { select: { course: { select: { tuitionFee: true } } } } } }`, then build the prefill.
The already-paid prefill is this enrollment's share of the purchase, using the same `allocate` the purchase form uses, so both surfaces agree:

```ts
  const catchUpPrefill =
    r.enrollment.totalDue === null
      ? {
          totalDue:
            r.enrollment.course.tuitionFee !== null &&
            r.enrollment.course.paymentFrequency !== "MONTHLY" &&
            r.enrollment.course.paymentFrequency !== "YEARLY"
              ? String(r.enrollment.course.tuitionFee.toNumber())
              : "",
          alreadyPaid: r.enrollment.purchase
            ? String(
                allocate(
                  r.enrollment.purchase.amountPaid.toNumber(),
                  r.enrollment.purchase.items.map(
                    (i) => i.course.tuitionFee?.toNumber() ?? null,
                  ),
                )[
                  r.enrollment.purchase.items.findIndex(
                    (i) => i.course.id === r.enrollment.course.id,
                  )
                ] ?? 0,
              )
            : "",
        }
      : null;
```

Select `id: true` on both `enrollment.course` and the purchase items' `course` so that index lookup works.
Import `allocate` from `@/lib/purchases/allocation`.

- [ ] **Step 8: Add the fields to the approve form**

In `app/(admin)/admin/payments/[id]/approve-form.tsx`, add an optional `catchUpPrefill` prop of the type above, and render, before the status radios, only when it is non-null:

```tsx
      {catchUpPrefill && (
        <div className="space-y-3 rounded-md border border-dashed p-3">
          <div>
            <p className="text-sm font-semibold">Start tracking this balance</p>
            <p className="text-muted-foreground text-sm">
              This enrollment has no agreed total yet. Set one to see the
              remaining balance from now on, or leave it blank to keep deciding
              by hand.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="totalDue">Total due (₱)</Label>
              <Input
                id="totalDue"
                name="totalDue"
                type="number"
                min="0"
                step="0.01"
                defaultValue={catchUpPrefill.totalDue}
              />
            </div>
            <div>
              <Label htmlFor="alreadyPaid">Already paid, before this (₱)</Label>
              <Input
                id="alreadyPaid"
                name="alreadyPaid"
                type="number"
                min="0"
                step="0.01"
                defaultValue={catchUpPrefill.alreadyPaid}
              />
            </div>
          </div>
        </div>
      )}
```

Import `Input` from `@/components/ui/input`, and pass `catchUpPrefill={payment.catchUpPrefill}` from `page.tsx`.

- [ ] **Step 9: Typecheck, test, lint, verify**

Run: `./node_modules/.bin/tsc --noEmit && pnpm vitest run && pnpm lint`

Then with `pnpm dev`, open a pending payment for an enrollment created before this feature, set a total and an already-paid amount, approve, and confirm the detail page for the next payment on that enrollment shows a real balance and no longer offers the tracking fields.

- [ ] **Step 10: Commit**

```bash
# format only this task's files, never `pnpm format`
git add app/\(admin\)/admin/payments/\[id\]/ lib/payments/queries.ts lib/__tests__/payments/approve.test.ts
git commit -m "feat: let admins start tracking the balance of an existing enrollment"
```

---

### Task 9: Student-facing balance

**Files:**
- Modify: `app/(student)/student/dashboard/page.tsx:334-339`
- Modify: `app/(student)/student/payments/[enrollmentId]/page.tsx`
- Modify: `lib/payments/queries.ts` (`getEnrollmentForPayment`, and the dashboard's enrollment fetch)

**Interfaces:**
- Consumes: `computeBalance`, `describeBalance`, `Balance`.
- Produces: `PaymentEnrollment` gains `balance: Balance`. A new `getEnrollmentBalances(userId): Promise<Record<string, Balance>>` keyed by enrollment id, for the dashboard.

- [ ] **Step 1: Add the dashboard balance query**

In `lib/payments/queries.ts`, alongside `getEnrollmentPaymentStates`:

```ts
// One balance per enrollment for the dashboard's Payment section, keyed by
// enrollment id. Mirrors getEnrollmentPaymentStates, which the same section
// already calls.
export async function getEnrollmentBalances(
  userId: string,
): Promise<Record<string, Balance>> {
  const rows = await db.enrollment.findMany({
    where: { userId },
    select: {
      id: true,
      totalDue: true,
      payments: { where: { status: "APPROVED" }, select: { amount: true } },
    },
  });

  return Object.fromEntries(
    rows.map((r) => [
      r.id,
      computeBalance(
        r.totalDue?.toNumber() ?? null,
        r.payments.map((p) => p.amount.toNumber()),
      ),
    ]),
  );
}
```

- [ ] **Step 2: Use it on the dashboard**

In `app/(student)/student/dashboard/page.tsx`, add `getEnrollmentBalances(session.userId)` to the existing `Promise.all` that already fetches `paymentStates` at line 53, destructuring it as `balances`.

Then replace the fixed line at line 337:

```tsx
                    <p className="text-xs text-amber-600 mt-0.5">
                      Partial payment — balance outstanding
                    </p>
```

with:

```tsx
                    <p className="text-xs text-amber-600 mt-0.5">
                      {balanceLine(balances[e.id])}
                    </p>
```

with this helper above the component in the same file, which keeps the JSX
readable and gives TypeScript something it can narrow:

```tsx
function balanceLine(balance: Balance | undefined): string {
  if (balance && balance.kind === "tracked") return describeBalance(balance);
  return "Partial payment - balance outstanding";
}
```

Import both with `import { describeBalance, type Balance } from "@/lib/payments/balance";`.

The fallback copy keeps its meaning and loses the em dash, which does not match the punctuation used elsewhere in the app.

- [ ] **Step 3: Show the balance above the payment form**

In `lib/payments/queries.ts`, add `balance: Balance` to `PaymentEnrollment`, and in `getEnrollmentForPayment` select `totalDue` plus the approved amounts.
Note that `payments` is already selected there for the guard with `select: { status: true }`; add `amount: true` and `status: true` and compute the balance from the approved subset in the mapped result, so the guard keeps the full list it needs.

This means `getEnrollmentForPayment` returns a mapped object rather than the raw Prisma row.
Keep the returned shape identical apart from the added `balance`, so `canAddPayment` continues to work unchanged.

In `app/(student)/student/payments/[enrollmentId]/page.tsx`, below the course title paragraph:

```tsx
      {enrollment.balance.kind === "tracked" && (
        <p className="mt-2 text-sm font-medium text-amber-600">
          {describeBalance(enrollment.balance)}
        </p>
      )}
```

Do not prefill or validate the amount field against this number.
Students overpay and underpay for real reasons, and rejecting a payment they have already sent would be worse than recording it.

- [ ] **Step 4: Typecheck, test, lint**

Run: `./node_modules/.bin/tsc --noEmit && pnpm vitest run && pnpm lint`
Expected: all pass. `lib/__tests__/payments/guards.test.ts` tests `canAddPayment` directly and is unaffected.

- [ ] **Step 5: Verify the whole flow in the browser**

With `pnpm dev`:

1. As an admin, approve a two-course pending purchase, editing the split so one course gets more than its proportional share.
2. As that student, confirm the dashboard shows the right remaining balance per course.
3. Submit an additional payment that settles one course exactly.
4. As the admin, open it and confirm the balance summary shows the before and after figures and that the status radio has defaulted to Fully paid.
5. Approve it, and confirm the student's dashboard no longer lists that course as partially paid.

- [ ] **Step 6: Commit**

```bash
# format only this task's files, never `pnpm format`
git add lib/payments/queries.ts app/\(student\)/student/
git commit -m "feat: show students their remaining balance"
```

---

## Done when

- `pnpm vitest run`, `./node_modules/.bin/tsc --noEmit`, and `pnpm lint` all pass.
- The browser walkthrough in Task 9 Step 5 completes as described.
- `/admin/payments` shows no checkout rows on any tab.
