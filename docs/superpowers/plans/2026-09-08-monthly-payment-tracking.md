# Monthly Payment Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each `Payment` the month it covers, so an admin can see, per monthly course, which students are paid up and which are behind.

**Architecture:** One nullable `Payment.periodMonth` column (`@db.Date`) records which Manila calendar month a payment settles.
All month arithmetic lives in two pure, db-free modules (`lib/time/manila.ts`, `lib/payments/monthly.ts`) that every surface calls, in the same posture `lib/payments/balance.ts` already holds for balances.
The set of months a student owes is derived on read from `enrolledAt` and today, never stored, so it cannot drift out of sync with the enrollment.

**Tech Stack:** Next.js App Router (server components + server actions), TypeScript, Prisma 7 against hosted Supabase Postgres, Zod, Vitest, Tailwind + shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-09-08-monthly-payment-tracking-design.md`

## Global Constraints

- **Package manager is `pnpm`.** Never `npm` or `yarn`.
- **You cannot run database migrations yourself.** Any DB-touching Prisma command (`migrate dev`, `migrate deploy`, `migrate status`) is blocked by the sandbox classifier, and `migrate dev` also fails with "non-interactive not supported" because there is no TTY. Task 3 stops and asks the user to run it in their own terminal. `pnpm prisma generate` IS allowed and is safe.
- **Never run `prettier --write` on existing files.** `.prettierrc` disagrees with the real house style and reformatting produces enormous spurious diffs.
- **Match the style of the file you are editing.** `lib/payments/*` uses semicolons and double quotes; `lib/student/queries.ts` uses neither. New files under `lib/payments/` and `lib/time/` follow the `lib/payments/*` style.
- **Never write to `app/generated/prisma/`.** It is a stale, unused, git-tracked leftover excluded in `tsconfig.json`. The real client is `@prisma/client` in `node_modules`.
- **Money is compared in integer centavos**, never as floats. Summing floats leaves residuals like `3.64e-12` that render as a permanent one-centavo shortfall on a month that settled exactly. `lib/payments/balance.ts` documents this.
- **Only `APPROVED` payments count as money received.** Pending and rejected payments never move a status.
- **Run `pnpm vitest run <path>`** for a single test file. Bare `pnpm test` starts vitest in watch mode and will hang.
- **Commit messages:** no `Co-Authored-By` for the agent, no "Generated with" trailer.
- **No em dashes** in any prose you write. Use a plain dash.

---

## File Structure

**Create:**
- `lib/time/manila.ts` - Manila calendar month primitives: `MonthKey`, conversion to and from `Date`, range enumeration, display labels. Knows nothing about payments.
- `lib/payments/monthly.ts` - the billing rules: which months an enrollment owes, whether a month is settled, and the matrix assembly. Pure, no db.
- `lib/payments/monthly-queries.ts` - the two database reads the admin matrix needs. Separate from `lib/payments/queries.ts`, which is already long enough that adding matrix assembly to it would make it unreadable in one sitting.
- `app/(admin)/admin/payments/monthly/monthly-matrix.tsx` - the matrix table, a presentational client-free component.
- `lib/__tests__/time/manila.test.ts`, `lib/__tests__/payments/monthly.test.ts`, `lib/__tests__/payments/monthly-queries.test.ts`, `lib/__tests__/payments/monthly-guards.test.ts`

**Modify:**
- `prisma/schema.prisma` - add `Payment.periodMonth` and its index.
- `lib/payments/guards.ts` - per-month pending rule, monthly enrollments never settled.
- `lib/payments/queries.ts` - select `periodMonth` and `course.paymentFrequency` where the guards now need them.
- `lib/payments/schema.ts` - optional `periodMonth` on the create schema.
- `lib/payments/actions.ts` - accept, validate, and persist `periodMonth`.
- `app/(student)/student/payments/[enrollmentId]/payment-form.tsx` and `page.tsx` - the month picker.
- `app/(student)/student/dashboard/page.tsx` and `lib/student/queries.ts` - pass `paymentFrequency` into `isSettled`.
- `app/(admin)/admin/payments/page.tsx` - the Monthly tab.
- `app/(admin)/admin/payments/[id]/page.tsx`, `approve-form.tsx`, `actions.ts` - show and set the covered month.

---

## Task 1: Manila month primitives

**Files:**
- Create: `lib/time/manila.ts`
- Test: `lib/__tests__/time/manila.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type MonthKey = string`, `toMonthKey(date: Date): MonthKey`, `monthKeyToDate(key: MonthKey): Date`, `dateToMonthKey(date: Date): MonthKey`, `nextMonthKey(key: MonthKey): MonthKey`, `monthKeysBetween(start: MonthKey, end: MonthKey): MonthKey[]`, `monthKeyLabel(key: MonthKey): string`, `monthKeyShort(key: MonthKey): string`.

Do not touch `lib/batches/name.ts`.
It owns a Manila formatter producing a different format ("0926") for a different purpose, a snapshotted batch label that must never be recomputed.
Folding the two together to avoid a duplicated `Intl.DateTimeFormat` would couple them for no gain.

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/time/manila.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  toMonthKey,
  monthKeyToDate,
  dateToMonthKey,
  nextMonthKey,
  monthKeysBetween,
  monthKeyLabel,
  monthKeyShort,
} from "@/lib/time/manila";

describe("toMonthKey", () => {
  it("reads the month off the Manila calendar, not UTC", () => {
    // 00:30 on 1 October in Manila is still 16:30 on 30 September in UTC.
    // Vercel runs in UTC, so answering this from the server clock bills the
    // student for the wrong month.
    expect(toMonthKey(new Date("2026-10-01T00:30:00+08:00"))).toBe("2026-10");
  });

  it("does not roll a late-UTC instant forward past the Manila month", () => {
    // 23:00 on 30 September UTC is 07:00 on 1 October in Manila.
    expect(toMonthKey(new Date("2026-09-30T23:00:00Z"))).toBe("2026-10");
  });

  it("zero-pads single-digit months so keys sort lexicographically", () => {
    expect(toMonthKey(new Date("2026-03-15T12:00:00+08:00"))).toBe("2026-03");
  });
});

describe("monthKeyToDate / dateToMonthKey", () => {
  it("anchors a month to its first day at UTC midnight", () => {
    expect(monthKeyToDate("2026-09").toISOString()).toBe(
      "2026-09-01T00:00:00.000Z",
    );
  });

  it("round-trips a stored @db.Date value back to its key", () => {
    // Prisma hands a @db.Date column back as UTC midnight. Reading it in
    // Manila time would shift it to 08:00 the same day, which is harmless
    // here, but the operation is a plain unwrap, not a timezone conversion.
    expect(dateToMonthKey(new Date("2026-09-01T00:00:00.000Z"))).toBe("2026-09");
  });

  it("round-trips through both directions", () => {
    expect(dateToMonthKey(monthKeyToDate("2027-01"))).toBe("2027-01");
  });
});

describe("nextMonthKey", () => {
  it("advances within a year", () => {
    expect(nextMonthKey("2026-09")).toBe("2026-10");
  });

  it("rolls December over into the next January", () => {
    expect(nextMonthKey("2026-12")).toBe("2027-01");
  });
});

describe("monthKeysBetween", () => {
  it("is inclusive of both ends", () => {
    expect(monthKeysBetween("2026-06", "2026-09")).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
  });

  it("returns the single month when start equals end", () => {
    expect(monthKeysBetween("2026-06", "2026-06")).toEqual(["2026-06"]);
  });

  it("crosses a year boundary", () => {
    expect(monthKeysBetween("2026-11", "2027-02")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });

  it("returns nothing when the end precedes the start", () => {
    // A naive month-increment loop runs forever here. This is the guard.
    expect(monthKeysBetween("2026-09", "2026-06")).toEqual([]);
  });
});

describe("labels", () => {
  it("renders a full label for headings", () => {
    expect(monthKeyLabel("2026-09")).toBe("September 2026");
  });

  it("renders a short label for matrix columns", () => {
    expect(monthKeyShort("2026-09")).toBe("Sep");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run lib/__tests__/time/manila.test.ts`
Expected: FAIL, with a resolution error for `@/lib/time/manila`.

- [ ] **Step 3: Write the implementation**

Create `lib/time/manila.ts`:

```ts
// Vercel runs in UTC while the academy runs on Philippine time, so every
// "which month is this" question has to be answered on the Manila calendar.
// A payment submitted at 00:30 on 1 October in Manila is still 30 September
// in UTC, and answering from the server clock bills it to the wrong month.
//
// `lib/batches/name.ts` has its own Manila formatter. It produces a different
// format for a different purpose - a label snapshotted at batch creation that
// must never be recomputed - and the two are deliberately not shared.

// "2026-09". The canonical key for a billing month across the payment code.
// Zero-padded so plain string comparison orders months correctly, which is
// what makes the range and sort logic below safe.
export type MonthKey = string;

const MANILA_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
});

// For an instant that really happened, such as "now" or an enrollment date.
export function toMonthKey(date: Date): MonthKey {
  const parts = MANILA_PARTS.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

// The value stored in `Payment.periodMonth`: the month's first day at UTC
// midnight. The column is `@db.Date`, which carries no time, so there is no
// clock left to drift across the date line.
export function monthKeyToDate(key: MonthKey): Date {
  return new Date(`${key}-01T00:00:00.000Z`);
}

// The inverse, for a value read back out of `@db.Date`. Deliberately UTC and
// not Manila: this unwraps an anchor we wrote ourselves, it does not convert
// a real instant into a calendar month the way `toMonthKey` does.
export function dateToMonthKey(date: Date): MonthKey {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

export function nextMonthKey(key: MonthKey): MonthKey {
  const [year, month] = key.split("-").map(Number);
  if (month === 12) return `${year + 1}-01`;
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

// Inclusive of both ends. An end before the start yields nothing rather than
// looping forever, which is the failure mode of the obvious implementation.
export function monthKeysBetween(start: MonthKey, end: MonthKey): MonthKey[] {
  if (end < start) return [];
  const keys: MonthKey[] = [];
  for (let cur = start; cur <= end; cur = nextMonthKey(cur)) keys.push(cur);
  return keys;
}

// Both labels format the UTC anchor in UTC. Formatting it in Manila would
// render the same day at 08:00, which cannot change the month, but keeping
// the anchor's own zone makes the intent obvious.
const LONG_LABEL = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "long",
});

const SHORT_LABEL = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
});

export function monthKeyLabel(key: MonthKey): string {
  return LONG_LABEL.format(monthKeyToDate(key));
}

export function monthKeyShort(key: MonthKey): string {
  return SHORT_LABEL.format(monthKeyToDate(key));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run lib/__tests__/time/manila.test.ts`
Expected: PASS, 14 tests.

If `monthKeyLabel` returns "September 2026" but the test compares against a string with a different space character, check that `Intl` is not emitting a narrow no-break space. If it is, assert with `toMatch(/September\s2026/)` instead.

- [ ] **Step 5: Typecheck and commit**

```bash
./node_modules/.bin/tsc --noEmit
git add lib/time/manila.ts lib/__tests__/time/manila.test.ts
git commit -m "feat: add Manila calendar month primitives"
```

---

## Task 2: Billing rules

**Files:**
- Create: `lib/payments/monthly.ts`
- Test: `lib/__tests__/payments/monthly.test.ts`

**Interfaces:**
- Consumes: `MonthKey`, `toMonthKey`, `monthKeysBetween` from `lib/time/manila`.
- Produces: `monthsOwed(enrolledAt: Date, endedAt: Date | null, now: Date): MonthKey[]`; `type MonthStatus`; `monthStatus(monthlyFee: number | null, approvedAmounts: number[]): MonthStatus`; `type MonthCell`; `type MatrixRow`; `type MonthlyMatrix`; `type MatrixEnrollment`; `type MatrixPayment`; `buildMonthlyMatrix(enrollments: MatrixEnrollment[], monthlyFee: number | null, now: Date): MonthlyMatrix`.

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/payments/monthly.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  monthsOwed,
  monthStatus,
  buildMonthlyMatrix,
  type MatrixEnrollment,
} from "@/lib/payments/monthly";

const NOW = new Date("2026-09-08T10:00:00+08:00");

describe("monthsOwed", () => {
  it("owes every month from enrollment through the current month", () => {
    expect(
      monthsOwed(new Date("2026-06-12T09:00:00+08:00"), null, NOW),
    ).toEqual(["2026-06", "2026-07", "2026-08", "2026-09"]);
  });

  it("owes the whole month a student enrolled at the end of", () => {
    // No proration. A student joining on the 28th owes that month in full.
    expect(
      monthsOwed(new Date("2026-09-28T09:00:00+08:00"), null, NOW),
    ).toEqual(["2026-09"]);
  });

  it("crosses a year boundary", () => {
    expect(
      monthsOwed(
        new Date("2026-12-15T09:00:00+08:00"),
        null,
        new Date("2027-01-05T09:00:00+08:00"),
      ),
    ).toEqual(["2026-12", "2027-01"]);
  });

  it("stops accruing at the month the enrollment ended", () => {
    // A removed student owes up to the month they were removed and no more.
    // The row survives so the arrears stay visible and auditable.
    expect(
      monthsOwed(
        new Date("2026-06-12T09:00:00+08:00"),
        new Date("2026-07-20T09:00:00+08:00"),
        NOW,
      ),
    ).toEqual(["2026-06", "2026-07"]);
  });

  it("ignores an end date in the future", () => {
    expect(
      monthsOwed(
        new Date("2026-06-12T09:00:00+08:00"),
        new Date("2027-06-12T09:00:00+08:00"),
        NOW,
      ),
    ).toEqual(["2026-06", "2026-07", "2026-08", "2026-09"]);
  });

  it("returns nothing for an enrollment dated in the future", () => {
    expect(
      monthsOwed(new Date("2026-11-01T09:00:00+08:00"), null, NOW),
    ).toEqual([]);
  });
});

describe("monthStatus", () => {
  it("is paid when the exact fee is covered", () => {
    expect(monthStatus(1500, [1500])).toEqual({ kind: "paid", paid: 1500 });
  });

  it("is paid when several payments sum exactly to the fee", () => {
    // Float summing leaves residuals like 3.64e-12 that render as a permanent
    // one-centavo shortfall. Integer centavos is the reason this passes.
    expect(monthStatus(1500, [500.1, 499.9, 500])).toEqual({
      kind: "paid",
      paid: 1500,
    });
  });

  it("is paid when overpaid, and does not flag it", () => {
    expect(monthStatus(1500, [2000])).toEqual({ kind: "paid", paid: 2000 });
  });

  it("is partial one centavo under the fee, with the shortfall", () => {
    expect(monthStatus(1500, [1499.99])).toEqual({
      kind: "partial",
      paid: 1499.99,
      short: 0.01,
    });
  });

  it("is partial with the shortfall for a part payment", () => {
    expect(monthStatus(1500, [800])).toEqual({
      kind: "partial",
      paid: 800,
      short: 700,
    });
  });

  it("is unpaid with no payments", () => {
    expect(monthStatus(1500, [])).toEqual({ kind: "unpaid" });
  });

  it("is paid when the fee is zero and nothing was paid", () => {
    // Nothing owed is settled, not outstanding.
    expect(monthStatus(0, [])).toEqual({ kind: "paid", paid: 0 });
  });

  it("is unscored when the course has no fee", () => {
    // The money is known; the verdict is not. Reporting "unpaid" here would
    // accuse every student on a course whose fee an admin has not filled in.
    expect(monthStatus(null, [800])).toEqual({ kind: "unscored", paid: 800 });
    expect(monthStatus(null, [])).toEqual({ kind: "unscored", paid: 0 });
  });
});

describe("buildMonthlyMatrix", () => {
  const enrollment = (
    over: Partial<MatrixEnrollment> & Pick<MatrixEnrollment, "id">,
  ): MatrixEnrollment => ({
    enrolledAt: new Date("2026-06-12T09:00:00+08:00"),
    completedAt: null,
    removedAt: null,
    student: { firstName: "A", lastName: "B", email: "a@b.c" },
    payments: [],
    ...over,
  });

  it("spans the union of every enrollment's owed months", () => {
    const matrix = buildMonthlyMatrix(
      [
        enrollment({ id: "e1" }),
        enrollment({
          id: "e2",
          enrolledAt: new Date("2026-08-01T09:00:00+08:00"),
        }),
      ],
      1500,
      NOW,
    );
    expect(matrix.months).toEqual(["2026-06", "2026-07", "2026-08", "2026-09"]);
  });

  it("marks months a student was not yet enrolled for as not owed", () => {
    const matrix = buildMonthlyMatrix(
      [
        enrollment({ id: "e1" }),
        enrollment({
          id: "e2",
          enrolledAt: new Date("2026-08-01T09:00:00+08:00"),
        }),
      ],
      1500,
      NOW,
    );
    const late = matrix.rows.find((r) => r.enrollmentId === "e2")!;
    expect(late.cells.map((c) => c.owed)).toEqual([false, false, true, true]);
  });

  it("counts only approved payments toward a month", () => {
    const matrix = buildMonthlyMatrix(
      [
        enrollment({
          id: "e1",
          enrolledAt: new Date("2026-09-01T09:00:00+08:00"),
          payments: [
            { amount: 1500, periodMonth: "2026-09", status: "PENDING" },
          ],
        }),
      ],
      1500,
      NOW,
    );
    const cell = matrix.rows[0].cells[0];
    expect(cell.owed && cell.status).toEqual({ kind: "unpaid" });
  });

  it("flags a month with a pending payment so nobody chases that student", () => {
    const matrix = buildMonthlyMatrix(
      [
        enrollment({
          id: "e1",
          enrolledAt: new Date("2026-09-01T09:00:00+08:00"),
          payments: [
            { amount: 1500, periodMonth: "2026-09", status: "PENDING" },
          ],
        }),
      ],
      1500,
      NOW,
    );
    const cell = matrix.rows[0].cells[0];
    expect(cell.owed && cell.hasPending).toBe(true);
  });

  it("counts partial and unpaid months as behind, and sums the shortfalls", () => {
    const matrix = buildMonthlyMatrix(
      [
        enrollment({
          id: "e1",
          enrolledAt: new Date("2026-08-01T09:00:00+08:00"),
          payments: [
            { amount: 800, periodMonth: "2026-08", status: "APPROVED" },
          ],
        }),
      ],
      1500,
      NOW,
    );
    // August is 700 short, September is untouched: two months, 2200.
    expect(matrix.rows[0].monthsBehind).toBe(2);
    expect(matrix.rows[0].amountBehind).toBe(2200);
  });

  it("holds approved money with no month in a separate unassigned total", () => {
    const matrix = buildMonthlyMatrix(
      [
        enrollment({
          id: "e1",
          enrolledAt: new Date("2026-09-01T09:00:00+08:00"),
          payments: [{ amount: 1500, periodMonth: null, status: "APPROVED" }],
        }),
      ],
      1500,
      NOW,
    );
    expect(matrix.rows[0].unassigned).toBe(1500);
    // Until someone says which month it covers, it settles nothing.
    expect(matrix.rows[0].amountBehind).toBe(1500);
  });

  it("counts nothing as behind when the course has no fee", () => {
    const matrix = buildMonthlyMatrix(
      [
        enrollment({
          id: "e1",
          enrolledAt: new Date("2026-08-01T09:00:00+08:00"),
        }),
      ],
      null,
      NOW,
    );
    expect(matrix.rows[0].monthsBehind).toBe(0);
    expect(matrix.rows[0].amountBehind).toBe(0);
  });

  it("sorts the most-behind student first", () => {
    const matrix = buildMonthlyMatrix(
      [
        enrollment({
          id: "settled",
          enrolledAt: new Date("2026-09-01T09:00:00+08:00"),
          student: { firstName: "Aisha", lastName: "R", email: "a@x.c" },
          payments: [
            { amount: 1500, periodMonth: "2026-09", status: "APPROVED" },
          ],
        }),
        enrollment({
          id: "behind",
          enrolledAt: new Date("2026-07-01T09:00:00+08:00"),
          student: { firstName: "Yusuf", lastName: "M", email: "y@x.c" },
        }),
      ],
      1500,
      NOW,
    );
    expect(matrix.rows.map((r) => r.enrollmentId)).toEqual([
      "behind",
      "settled",
    ]);
  });

  it("tallies each month column", () => {
    const matrix = buildMonthlyMatrix(
      [
        enrollment({
          id: "e1",
          enrolledAt: new Date("2026-09-01T09:00:00+08:00"),
          payments: [
            { amount: 1500, periodMonth: "2026-09", status: "APPROVED" },
          ],
        }),
        enrollment({
          id: "e2",
          enrolledAt: new Date("2026-09-01T09:00:00+08:00"),
          payments: [
            { amount: 800, periodMonth: "2026-09", status: "APPROVED" },
          ],
        }),
        enrollment({
          id: "e3",
          enrolledAt: new Date("2026-09-01T09:00:00+08:00"),
        }),
      ],
      1500,
      NOW,
    );
    expect(matrix.tallies).toEqual([
      { month: "2026-09", paid: 1, partial: 1, unpaid: 1, unscored: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run lib/__tests__/payments/monthly.test.ts`
Expected: FAIL, with a resolution error for `@/lib/payments/monthly`.

- [ ] **Step 3: Write the implementation**

Create `lib/payments/monthly.ts`:

```ts
// The billing rules for a course paid monthly. Pure and db-free, in the same
// posture as `computeBalance` in ./balance.ts: every admin and student
// surface calls this rather than doing its own month arithmetic, so they
// cannot disagree about which months a student owes.

import {
  toMonthKey,
  monthKeysBetween,
  type MonthKey,
} from "@/lib/time/manila";

// A student owes every Manila month from the one they enrolled in through
// the current one. Accrual stops at completion or removal.
//
// Derived on read, never stored: there is no schedule table and no job that
// writes a row when a month turns over, so this cannot fall out of sync with
// the enrollment. An end date in the future is ignored rather than trusted,
// so a bad value cannot invent months nobody owes yet.
export function monthsOwed(
  enrolledAt: Date,
  endedAt: Date | null,
  now: Date,
): MonthKey[] {
  const last = endedAt !== null && endedAt < now ? endedAt : now;
  return monthKeysBetween(toMonthKey(enrolledAt), toMonthKey(last));
}

export type MonthStatus =
  | { kind: "paid"; paid: number }
  | { kind: "partial"; paid: number; short: number }
  | { kind: "unpaid" }
  // The course has no tuitionFee, so the money is known but the verdict is
  // not. Reporting "unpaid" here would accuse every student on a course whose
  // fee an admin simply has not filled in yet.
  | { kind: "unscored"; paid: number };

// `approvedAmounts` must already be filtered to APPROVED rows for one month.
// Pending and rejected payments are not money received.
export function monthStatus(
  monthlyFee: number | null,
  approvedAmounts: number[],
): MonthStatus {
  // Integer centavos, for the reason ./balance.ts documents: summing floats
  // leaves residuals like 3.64e-12 that render as a permanent one-centavo
  // shortfall. Several payments per month is the normal case here, so the
  // risk is higher than it is for a single enrollment balance.
  const paidCentavos = approvedAmounts.reduce(
    (sum, amount) => sum + Math.round(amount * 100),
    0,
  );
  const paid = paidCentavos / 100;
  if (monthlyFee === null) return { kind: "unscored", paid };

  const feeCentavos = Math.round(monthlyFee * 100);
  // Checked before the zero case so a zero fee reads as settled rather than
  // as an outstanding month nobody can ever pay off.
  if (paidCentavos >= feeCentavos) return { kind: "paid", paid };
  if (paidCentavos === 0) return { kind: "unpaid" };
  return { kind: "partial", paid, short: (feeCentavos - paidCentavos) / 100 };
}

export type MatrixPayment = {
  amount: number;
  periodMonth: MonthKey | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

export type MatrixEnrollment = {
  id: string;
  enrolledAt: Date;
  completedAt: Date | null;
  removedAt: Date | null;
  student: { firstName: string; lastName: string; email: string };
  payments: MatrixPayment[];
};

// A cell is either outside this enrollment's owed range, or a verdict. The
// distinction matters: a student who joined in August has no opinion about
// June, and rendering that as "unpaid" would invent three months of arrears.
export type MonthCell =
  | { month: MonthKey; owed: false }
  | { month: MonthKey; owed: true; status: MonthStatus; hasPending: boolean };

export type MatrixRow = {
  enrollmentId: string;
  studentName: string;
  studentEmail: string;
  removedAt: Date | null;
  // Approved money carrying no month. Deliberately not netted against
  // `amountBehind`: until someone says which month it covers, it settles
  // nothing.
  unassigned: number;
  cells: MonthCell[];
  monthsBehind: number;
  amountBehind: number;
};

export type MonthTally = {
  month: MonthKey;
  paid: number;
  partial: number;
  unpaid: number;
  unscored: number;
};

export type MonthlyMatrix = {
  months: MonthKey[];
  rows: MatrixRow[];
  tallies: MonthTally[];
};

export function buildMonthlyMatrix(
  enrollments: MatrixEnrollment[],
  monthlyFee: number | null,
  now: Date,
): MonthlyMatrix {
  const owedByEnrollment = new Map<string, Set<MonthKey>>();
  const allMonths = new Set<MonthKey>();
  for (const e of enrollments) {
    const owed = monthsOwed(e.enrolledAt, e.removedAt ?? e.completedAt, now);
    owedByEnrollment.set(e.id, new Set(owed));
    for (const m of owed) allMonths.add(m);
  }
  // Keys are zero-padded, so a plain sort orders them chronologically.
  const months = [...allMonths].sort();

  const rows: MatrixRow[] = enrollments.map((e) => {
    const owed = owedByEnrollment.get(e.id) ?? new Set<MonthKey>();
    const approvedByMonth = new Map<MonthKey, number[]>();
    const pendingMonths = new Set<MonthKey>();
    let unassigned = 0;

    for (const p of e.payments) {
      if (p.status === "PENDING") {
        if (p.periodMonth !== null) pendingMonths.add(p.periodMonth);
        continue;
      }
      if (p.status !== "APPROVED") continue;
      if (p.periodMonth === null) {
        unassigned = (Math.round(unassigned * 100) + Math.round(p.amount * 100)) / 100;
        continue;
      }
      const bucket = approvedByMonth.get(p.periodMonth);
      if (bucket) bucket.push(p.amount);
      else approvedByMonth.set(p.periodMonth, [p.amount]);
    }

    let monthsBehind = 0;
    let behindCentavos = 0;
    const cells: MonthCell[] = months.map((month) => {
      if (!owed.has(month)) return { month, owed: false };
      const status = monthStatus(monthlyFee, approvedByMonth.get(month) ?? []);
      if (status.kind === "unpaid") {
        monthsBehind += 1;
        behindCentavos += Math.round((monthlyFee ?? 0) * 100);
      } else if (status.kind === "partial") {
        monthsBehind += 1;
        behindCentavos += Math.round(status.short * 100);
      }
      return {
        month,
        owed: true,
        status,
        hasPending: pendingMonths.has(month),
      };
    });

    return {
      enrollmentId: e.id,
      studentName: `${e.student.firstName} ${e.student.lastName}`,
      studentEmail: e.student.email,
      removedAt: e.removedAt,
      unassigned,
      cells,
      monthsBehind,
      amountBehind: behindCentavos / 100,
    };
  });

  // Most behind first, so the people who need chasing are at the top rather
  // than wherever the alphabet puts them. Name breaks ties for a stable order.
  rows.sort(
    (a, b) =>
      b.amountBehind - a.amountBehind ||
      a.studentName.localeCompare(b.studentName),
  );

  const tallies: MonthTally[] = months.map((month, i) => {
    const tally: MonthTally = {
      month,
      paid: 0,
      partial: 0,
      unpaid: 0,
      unscored: 0,
    };
    for (const row of rows) {
      const cell = row.cells[i];
      if (!cell.owed) continue;
      tally[cell.status.kind] += 1;
    }
    return tally;
  });

  return { months, rows, tallies };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run lib/__tests__/payments/monthly.test.ts`
Expected: PASS, 23 tests.

- [ ] **Step 5: Typecheck and commit**

```bash
./node_modules/.bin/tsc --noEmit
git add lib/payments/monthly.ts lib/__tests__/payments/monthly.test.ts
git commit -m "feat: add monthly billing rules for month accrual and status"
```

---

## Task 3: Schema migration

**Files:**
- Modify: `prisma/schema.prisma` (the `Payment` model, around line 429)

**Interfaces:**
- Consumes: nothing.
- Produces: `Payment.periodMonth: Date | null` on the generated Prisma client.

**This task cannot be completed by an agent alone.**
Every DB-touching Prisma command is blocked by the sandbox classifier, and `migrate dev` additionally fails with "non-interactive not supported" because there is no TTY.
Step 3 stops and hands the command to the user.

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`, inside `model Payment`, add the field after `source` and the index alongside the existing ones:

```prisma
  // The Manila calendar month this payment covers, stored as that month's
  // first day. `@db.Date` rather than a timestamp for the reason
  // BatchRecording.date carries the same annotation: Vercel runs in UTC and
  // the academy runs on Philippine time, so a month anchor with a clock on it
  // can fall on either side of the boundary and land in the wrong month.
  //
  // Null means the payment is not attributed to a month, which is true of
  // every row predating this field and of every payment on a course that is
  // not billed MONTHLY.
  periodMonth DateTime? @db.Date
```

and:

```prisma
  @@index([enrollmentId, periodMonth])
```

- [ ] **Step 2: Confirm nothing else in the schema changed**

Run: `git diff prisma/schema.prisma`
Expected: exactly the field, its comment, and the one index line.
A migration that carries an unrelated schema edit applies that edit to the shared production database.

- [ ] **Step 3: Ask the user to run the migration**

Stop and tell the user, verbatim:

> The schema change is in. I can't run migrations from here, the sandbox blocks every DB-touching Prisma command and `migrate dev` needs a TTY. Please run this in your own terminal and tell me when it's done:
>
> ```
> pnpm prisma migrate dev --name payment_period_month
> ```
>
> If it reports drift and offers to reset the database, **say no**. That prompt almost always means this branch is behind `origin/main`, not that anything is wrong with the database, and resetting would drop production data. Sync with `origin/main` first and re-run.

Wait for the user. Do not proceed.

- [ ] **Step 4: Verify the migration actually applied**

Do not trust a success message.
`migrate deploy` in particular prints "No pending migrations to apply" and silently does nothing when the schema change has no migration folder yet.

Run: `git status --short prisma/migrations/`
Expected: a new untracked directory named like `20260908XXXXXX_payment_period_month/` containing `migration.sql`.

Then refresh the client, since the classifier likely blocked the generate substep of the user's `migrate dev`:

Run: `pnpm prisma generate`
Expected: "Generated Prisma Client".

- [ ] **Step 5: Prove the column exists**

Mocked unit tests cannot catch a missing column, because every test mocks `@/lib/db`.
Create `scripts/check-period-month.ts` (it must live inside the repo root, a script in `/tmp` cannot resolve the project's `node_modules`):

```ts
import { db } from "../lib/db";

// Read-only. Proves the column exists on the real database rather than only
// in the generated types.
const row = await db.payment.findFirst({
  select: { id: true, periodMonth: true },
});
console.log("ok, periodMonth readable:", row);
await db.$disconnect();
```

Run: `pnpm tsx scripts/check-period-month.ts`
Expected: `ok, periodMonth readable:` followed by a row or `null`.
A `column Payment.periodMonth does not exist` error means the migration did not apply; go back to Step 3.

Delete the script afterwards: `rm scripts/check-period-month.ts`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Payment.periodMonth for monthly billing attribution"
```

---

## Task 4: Guard fixes

**Files:**
- Modify: `lib/payments/guards.ts`
- Modify: `lib/payments/queries.ts` (`getEnrollmentForPayment`, `getEnrollmentBalances`)
- Modify: `lib/student/queries.ts:13-21` (`DashboardEnrollment`) and its `select`
- Modify: `app/(student)/student/dashboard/page.tsx:76`
- Modify: `app/(student)/student/payments/[enrollmentId]/page.tsx:24`
- Test: `lib/__tests__/payments/monthly-guards.test.ts`

**Interfaces:**
- Consumes: `MonthKey` from `lib/time/manila`.
- Produces: `GuardEnrollment` gains `course.paymentFrequency: PaymentFrequency | null`; `GuardPayment` gains `periodMonth: MonthKey | null`; `canAddPayment(enrollment, payments, periodMonth?: MonthKey | null)`; `isSettled` takes `{ paymentStatus, balance, paymentFrequency }`.
- `PaymentEnrollment` in `lib/payments/queries.ts` gains `course.paymentFrequency` and its `payments` gain `periodMonth`.

Two rules in `lib/payments/guards.ts` currently break monthly courses.
Both are load-bearing for this feature.

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/payments/monthly-guards.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { canAddPayment, isSettled } from "@/lib/payments/guards";

const monthlyEnrollment = {
  paymentStatus: "PARTIALLY_PAID" as const,
  course: { archivedAt: null, paymentFrequency: "MONTHLY" as const },
  balance: { kind: "untracked" as const },
};

const oneTimeEnrollment = {
  paymentStatus: "PARTIALLY_PAID" as const,
  course: { archivedAt: null, paymentFrequency: "ONE_TIME" as const },
  balance: { kind: "untracked" as const },
};

describe("canAddPayment on a monthly enrollment", () => {
  it("allows a second submission for a different month", () => {
    // A student catching up on three missed months has three proofs to
    // upload. The old rule made them wait for an admin between each one.
    const result = canAddPayment(
      monthlyEnrollment,
      [{ status: "PENDING", periodMonth: "2026-08" }],
      "2026-09",
    );
    expect(result).toEqual({ ok: true });
  });

  it("still rejects a second submission for the same month", () => {
    // This is the double-count the rule was written to prevent: two tabs or a
    // double-click otherwise create two rows for the same money.
    const result = canAddPayment(
      monthlyEnrollment,
      [{ status: "PENDING", periodMonth: "2026-09" }],
      "2026-09",
    );
    expect(result).toEqual({
      ok: false,
      reason: "You already have a payment for this month awaiting review.",
    });
  });

  it("still rejects when the course is archived", () => {
    const result = canAddPayment(
      {
        ...monthlyEnrollment,
        course: { archivedAt: new Date(), paymentFrequency: "MONTHLY" },
      },
      [],
      "2026-09",
    );
    expect(result.ok).toBe(false);
  });
});

describe("canAddPayment on a non-monthly enrollment", () => {
  it("still rejects any second submission while one is pending", () => {
    const result = canAddPayment(
      oneTimeEnrollment,
      [{ status: "PENDING", periodMonth: null }],
      null,
    );
    expect(result).toEqual({
      ok: false,
      reason: "You already have a payment awaiting review.",
    });
  });
});

describe("isSettled", () => {
  it("never settles a monthly enrollment, even one marked FULLY_PAID", () => {
    // The approve form makes the admin pick PARTIALLY_PAID or FULLY_PAID on
    // every approval. Picking FULLY_PAID used to lock a monthly student out
    // of paying forever, with "This enrollment is already fully paid" and no
    // way forward. It is not fully paid; it accrues another month shortly.
    expect(
      isSettled({
        paymentStatus: "FULLY_PAID",
        balance: { kind: "untracked" },
        paymentFrequency: "MONTHLY",
      }),
    ).toBe(false);
  });

  it("still settles a FULLY_PAID one-time enrollment", () => {
    expect(
      isSettled({
        paymentStatus: "FULLY_PAID",
        balance: { kind: "untracked" },
        paymentFrequency: "ONE_TIME",
      }),
    ).toBe(true);
  });

  it("still lets a tracked ledger outrank the FULLY_PAID label", () => {
    expect(
      isSettled({
        paymentStatus: "FULLY_PAID",
        balance: { kind: "tracked", totalDue: 5000, paid: 3000, remaining: 2000 },
        paymentFrequency: null,
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run lib/__tests__/payments/monthly-guards.test.ts`
Expected: FAIL. TypeScript will object to the extra `paymentFrequency` and `periodMonth` properties, and the monthly assertions will fail against the current logic.

- [ ] **Step 3: Rewrite the guards**

Replace the body of `lib/payments/guards.ts` below the existing header comment with:

```ts
import type { PaymentFrequency } from "@prisma/client";
import type { Balance } from "@/lib/payments/balance";
import type { MonthKey } from "@/lib/time/manila";

export type GuardEnrollment = {
  paymentStatus: "PARTIALLY_PAID" | "FULLY_PAID";
  course: {
    archivedAt: Date | null;
    paymentFrequency: PaymentFrequency | null;
  };
  balance: Balance;
};

export type GuardPayment = {
  status: "PENDING" | "APPROVED" | "REJECTED";
  periodMonth: MonthKey | null;
};

export type GuardResult = { ok: true } | { ok: false; reason: string };

// `periodMonth` is the month the student is submitting for, null on a course
// that is not billed monthly.
export function canAddPayment(
  enrollment: GuardEnrollment | null,
  payments: GuardPayment[],
  periodMonth: MonthKey | null = null,
): GuardResult {
  if (!enrollment) return { ok: false, reason: "Enrollment not found." };
  // A tracked balance is the ledger, and it outranks `paymentStatus` - a label
  // an admin sets by hand, which can read FULLY_PAID while the ledger still
  // shows money owed. Keying off the label alone left those students unable to
  // pay the rest and with nothing on screen explaining why.
  if (
    isSettled({
      paymentStatus: enrollment.paymentStatus,
      balance: enrollment.balance,
      paymentFrequency: enrollment.course.paymentFrequency,
    })
  ) {
    return { ok: false, reason: "This enrollment is already fully paid." };
  }
  if (enrollment.course.archivedAt !== null) {
    return { ok: false, reason: "This course is no longer available." };
  }

  // The one-pending-payment rule exists to stop two tabs, a double-click or a
  // retried submit from creating two rows for the same money. On a monthly
  // course that money is per month, so the rule is per month too: September
  // and October are different payments with different proofs, and a student
  // catching up should not have to wait for an admin between them.
  if (enrollment.course.paymentFrequency === "MONTHLY") {
    const clash = payments.some(
      (p) => p.status === "PENDING" && p.periodMonth === periodMonth,
    );
    if (clash) {
      return {
        ok: false,
        reason: "You already have a payment for this month awaiting review.",
      };
    }
    return { ok: true };
  }

  if (payments.some((p) => p.status === "PENDING")) {
    return { ok: false, reason: "You already have a payment awaiting review." };
  }
  return { ok: true };
}

// Exported so the dashboard decides which enrollments to offer an "Add
// payment" button for using the same rule the guard enforces. The two
// disagreeing is how an enrollment ends up unpayable with no explanation.
export function isSettled(enrollment: {
  paymentStatus: "PARTIALLY_PAID" | "FULLY_PAID";
  balance: Balance;
  paymentFrequency: PaymentFrequency | null;
}): boolean {
  // A monthly enrollment is never settled: it accrues another month shortly.
  // It is also untracked by design, so without this it fell through to the
  // FULLY_PAID label below - which an admin is forced to choose between on
  // every approval, and choosing it locked the student out permanently.
  if (enrollment.paymentFrequency === "MONTHLY") return false;
  if (enrollment.balance.kind === "tracked") {
    return enrollment.balance.remaining <= 0;
  }
  return enrollment.paymentStatus === "FULLY_PAID";
}
```

- [ ] **Step 4: Update every caller**

In `lib/payments/queries.ts`, `PaymentEnrollment` gains the two fields the guard now reads:

```ts
export type PaymentEnrollment = {
  id: string;
  paymentStatus: PaymentStatus;
  course: {
    title: string;
    archivedAt: Date | null;
    paymentFrequency: PaymentFrequency | null;
    tuitionFee: number | null;
  };
  enrolledAt: Date;
  completedAt: Date | null;
  removedAt: Date | null;
  // `amount` is here for Task 5's month picker, which needs the approved
  // total per month to know which months are still outstanding.
  payments: {
    status: EnrollmentStatus;
    periodMonth: MonthKey | null;
    amount: number;
  }[];
  balance: Balance;
};
```

Add `import type { PaymentFrequency } from "@prisma/client";` to the existing type import, and `import { dateToMonthKey, type MonthKey } from "@/lib/time/manila";`.

In `getEnrollmentForPayment`, extend the `select` and the mapping:

```ts
    select: {
      id: true,
      paymentStatus: true,
      totalDue: true,
      enrolledAt: true,
      completedAt: true,
      removedAt: true,
      course: {
        select: {
          title: true,
          archivedAt: true,
          paymentFrequency: true,
          tuitionFee: true,
        },
      },
      payments: {
        select: { status: true, amount: true, periodMonth: true },
      },
    },
```

```ts
  return {
    id: r.id,
    paymentStatus: r.paymentStatus,
    course: {
      title: r.course.title,
      archivedAt: r.course.archivedAt,
      paymentFrequency: r.course.paymentFrequency,
      tuitionFee: r.course.tuitionFee?.toNumber() ?? null,
    },
    enrolledAt: r.enrolledAt,
    completedAt: r.completedAt,
    removedAt: r.removedAt,
    payments: r.payments.map((p) => ({
      status: p.status,
      periodMonth: p.periodMonth ? dateToMonthKey(p.periodMonth) : null,
      amount: p.amount.toNumber(),
    })),
    balance: computeBalance(
      r.totalDue?.toNumber() ?? null,
      r.payments
        .filter((p) => p.status === "APPROVED")
        .map((p) => p.amount.toNumber()),
    ),
  };
```

In `lib/student/queries.ts`, `DashboardEnrollment.course` gains `paymentFrequency`:

```ts
  course: { title: string; imageUrl: string | null; tuitionFee: number | null; meetLink: string | null; paymentFrequency: PaymentFrequency | null }
```

Add `PaymentFrequency` to the existing `import type { ... } from '@prisma/client'` list, and add `paymentFrequency: true,` to the `course` select inside `getStudentDashboard` (around line 71, alongside `meetLink: true`).
Match this file's style: no semicolons, single quotes.

Then carry it through the mapping at `lib/student/queries.ts:143-148`:

```ts
      course: {
        title: e.course.title,
        imageUrl: e.course.imageUrl,
        tuitionFee: e.course.tuitionFee?.toNumber() ?? null,
        meetLink: e.course.meetLink,
        paymentFrequency: e.course.paymentFrequency,
      },
```

In `app/(student)/student/dashboard/page.tsx`, the `isSettled` call at line 76 gains the field:

```tsx
      !isSettled({
        paymentStatus: e.paymentStatus,
        balance: balances[e.id] ?? { kind: "untracked" },
        paymentFrequency: e.course.paymentFrequency,
      }),
```

In `app/(student)/student/payments/[enrollmentId]/page.tsx` the `canAddPayment` call needs no third argument yet.
Task 5 passes the selected month; here the page check stays advisory, as its comment already says.

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `pnpm vitest run lib/__tests__/`
Expected: PASS. If `lib/__tests__/payments/queries.test.ts` fails on a changed `select` shape, update its assertion to match the new selection; that is the test doing its job.

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/payments/guards.ts lib/payments/queries.ts lib/student/queries.ts \
  "app/(student)/student/dashboard/page.tsx" \
  lib/__tests__/payments/monthly-guards.test.ts lib/__tests__/payments/queries.test.ts
git commit -m "fix: unblock payments on monthly enrollments

canAddPayment's one-pending-per-enrollment rule stopped a student from
catching up on several missed months, and isSettled treated a monthly
enrollment an admin marked FULLY_PAID as permanently closed."
```

---

## Task 5: Student submits a month

**Files:**
- Modify: `lib/payments/schema.ts`
- Modify: `lib/payments/actions.ts:36-80`
- Modify: `app/(student)/student/payments/[enrollmentId]/payment-form.tsx`
- Modify: `app/(student)/student/payments/[enrollmentId]/page.tsx`
- Test: `lib/__tests__/payments/monthly-submit.test.ts`

**Interfaces:**
- Consumes: `monthsOwed`, `monthStatus` from `lib/payments/monthly`; `toMonthKey`, `nextMonthKey`, `monthKeyLabel`, `monthKeyToDate` from `lib/time/manila`; `PaymentEnrollment` from `lib/payments/queries`.
- Produces, exported from `lib/payments/monthly.ts`: `type SelectableMonth = { key: MonthKey; label: string; status: MonthStatus }`, `type PayableEnrollment = { enrolledAt: Date; completedAt: Date | null; removedAt: Date | null }`, `payableMonths(enrollment: PayableEnrollment, now: Date): MonthKey[]`, and

```ts
selectableMonths(
  enrollment: {
    enrolledAt: Date;
    completedAt: Date | null;
    removedAt: Date | null;
    course: { tuitionFee: number | null };
  },
  payments: MatrixPayment[],
  now: Date,
): SelectableMonth[]
```

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/payments/monthly-submit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { selectableMonths, payableMonths } from "@/lib/payments/monthly";

const NOW = new Date("2026-09-08T10:00:00+08:00");

const enrollment = {
  id: "e1",
  paymentStatus: "PARTIALLY_PAID" as const,
  course: {
    title: "Marhala 1",
    archivedAt: null,
    paymentFrequency: "MONTHLY" as const,
    tuitionFee: 1500,
  },
  enrolledAt: new Date("2026-07-01T09:00:00+08:00"),
  completedAt: null,
  removedAt: null,
  payments: [],
  balance: { kind: "untracked" as const },
};

describe("selectableMonths", () => {
  it("offers unsettled months oldest first, then next month for paying ahead", () => {
    expect(
      selectableMonths(enrollment, [], NOW).map((m) => m.key),
    ).toEqual(["2026-07", "2026-08", "2026-09", "2026-10"]);
  });

  it("drops months already fully paid", () => {
    const months = selectableMonths(
      enrollment,
      [
        { amount: 1500, periodMonth: "2026-07", status: "APPROVED" },
        { amount: 1500, periodMonth: "2026-08", status: "APPROVED" },
      ],
      NOW,
    );
    expect(months.map((m) => m.key)).toEqual(["2026-09", "2026-10"]);
  });

  it("keeps a partially paid month so the student can settle the rest", () => {
    const months = selectableMonths(
      enrollment,
      [{ amount: 800, periodMonth: "2026-07", status: "APPROVED" }],
      NOW,
    );
    expect(months[0].key).toBe("2026-07");
    expect(months[0].status).toEqual({
      kind: "partial",
      paid: 800,
      short: 700,
    });
  });

  it("labels each month for the picker", () => {
    expect(selectableMonths(enrollment, [], NOW)[0].label).toBe("July 2026");
  });

  it("still offers every month when the course fee is zero", () => {
    // A zero fee makes every month read as already paid, so the filtering
    // version returns nothing. `payableMonths` is what the action's bounds
    // check uses precisely so a zero-fee course does not reject everything.
    expect(
      payableMonths(
        {
          enrolledAt: new Date("2026-08-01T09:00:00+08:00"),
          completedAt: null,
          removedAt: null,
        },
        NOW,
      ),
    ).toEqual(["2026-08", "2026-09", "2026-10"]);
  });

  it("offers no look-ahead month for a removed enrollment", () => {
    expect(
      payableMonths(
        {
          enrolledAt: new Date("2026-08-01T09:00:00+08:00"),
          completedAt: null,
          removedAt: new Date("2026-09-02T09:00:00+08:00"),
        },
        NOW,
      ),
    ).toEqual(["2026-08", "2026-09"]);
  });

  it("offers only next month once everything owed is settled", () => {
    const months = selectableMonths(
      enrollment,
      [
        { amount: 1500, periodMonth: "2026-07", status: "APPROVED" },
        { amount: 1500, periodMonth: "2026-08", status: "APPROVED" },
        { amount: 1500, periodMonth: "2026-09", status: "APPROVED" },
      ],
      NOW,
    );
    expect(months.map((m) => m.key)).toEqual(["2026-10"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run lib/__tests__/payments/monthly-submit.test.ts`
Expected: FAIL with "selectableMonths is not a function".

- [ ] **Step 3: Add `selectableMonths` to `lib/payments/monthly.ts`**

Append to `lib/payments/monthly.ts`, and add `nextMonthKey` and `monthKeyLabel` to its import from `@/lib/time/manila`:

```ts
export type SelectableMonth = {
  key: MonthKey;
  label: string;
  status: MonthStatus;
};

export type PayableEnrollment = {
  enrolledAt: Date;
  completedAt: Date | null;
  removedAt: Date | null;
};

// Every month a payment may legitimately be filed against: the owed months
// plus one look-ahead so a student can pay next month early. Paying ahead is
// only offered while the enrollment is still accruing - a removed or
// completed student has no next month to pay for.
//
// This is the bounds check, and it is deliberately separate from
// `selectableMonths` below, which FILTERS this list down to what is still
// outstanding. Using the filtering version as a bounds check rejects every
// submission on a course whose fee is zero, because a zero fee makes every
// month read as already paid.
export function payableMonths(
  enrollment: PayableEnrollment,
  now: Date,
): MonthKey[] {
  const owed = monthsOwed(
    enrollment.enrolledAt,
    enrollment.removedAt ?? enrollment.completedAt,
    now,
  );
  const last = owed[owed.length - 1];
  if (
    last === undefined ||
    enrollment.removedAt !== null ||
    enrollment.completedAt !== null
  ) {
    return owed;
  }
  return [...owed, nextMonthKey(last)];
}

// The options in the student's "Paying for" picker: every payable month that
// is not fully settled, oldest first. Oldest first because a student catching
// up almost always means the oldest one, and it is what the form defaults to.
export function selectableMonths(
  enrollment: {
    enrolledAt: Date;
    completedAt: Date | null;
    removedAt: Date | null;
    course: { tuitionFee: number | null };
  },
  payments: MatrixPayment[],
  now: Date,
): SelectableMonth[] {
  const approvedByMonth = new Map<MonthKey, number[]>();
  for (const p of payments) {
    if (p.status !== "APPROVED" || p.periodMonth === null) continue;
    const bucket = approvedByMonth.get(p.periodMonth);
    if (bucket) bucket.push(p.amount);
    else approvedByMonth.set(p.periodMonth, [p.amount]);
  }

  const fee = enrollment.course.tuitionFee;
  return payableMonths(enrollment, now)
    .map((key) => ({
      key,
      label: monthKeyLabel(key),
      status: monthStatus(fee, approvedByMonth.get(key) ?? []),
    }))
    .filter((m) => m.status.kind !== "paid");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run lib/__tests__/payments/monthly-submit.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Accept the month in the schema and action**

In `lib/payments/schema.ts`:

```ts
import { z } from "zod";

export const createPaymentSchema = z.object({
  enrollmentId: z.string().min(1, "Enrollment is required."),
  amount: z.coerce.number().positive("Amount must be greater than 0."),
  // "2026-09". Present only for a course billed monthly; the action decides
  // whether it is required, since only it knows the course.
  periodMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Select which month this payment covers.")
    .nullish(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
```

In `lib/payments/actions.ts`, inside `createPaymentAction`:

```ts
  const result = createPaymentSchema.safeParse({
    enrollmentId: formData.get("enrollmentId"),
    amount: formData.get("amount"),
    periodMonth: formData.get("periodMonth"),
  });
  if (!result.success)
    return { error: result.error.issues[0]?.message ?? "Validation failed." };
  const { enrollmentId, amount } = result.data;
  const submittedMonth = result.data.periodMonth ?? null;
```

Then, after the `getEnrollmentForPayment` call and before the guard, validate the month against the course.
The form is advisory; this is the check that holds:

```ts
  const isMonthly = enrollment?.course.paymentFrequency === "MONTHLY";
  if (!isMonthly && submittedMonth !== null) {
    return { error: "This course is not billed monthly." };
  }
  if (isMonthly && enrollment) {
    if (submittedMonth === null) {
      return { error: "Select which month this payment covers." };
    }
    // Bounds only. `payableMonths` deliberately does not filter out settled
    // months: paying a settled month again is an overpayment for the admin to
    // judge, not a malformed request. A month outside the enrollment's range,
    // or more than one ahead, is.
    const offered = payableMonths(
      {
        enrolledAt: enrollment.enrolledAt,
        completedAt: enrollment.completedAt,
        removedAt: enrollment.removedAt,
      },
      new Date(),
    );
    if (!offered.includes(submittedMonth)) {
      return { error: "That month is not open for payment." };
    }
  }
```

Pass the month to the guard, and store it:

```ts
  const allowed = canAddPayment(
    enrollment,
    enrollment?.payments ?? [],
    submittedMonth,
  );
```

```ts
        return tx.payment.create({
          data: {
            enrollmentId,
            amount,
            periodMonth: submittedMonth
              ? monthKeyToDate(submittedMonth)
              : null,
            proofUrl: "", // set after upload
          },
          select: { id: true },
        });
```

Narrow the in-transaction duplicate re-check to the submitted month, so it enforces the same rule the guard does:

```ts
        const pending = await tx.payment.findFirst({
          where: isMonthly
            ? {
                enrollmentId,
                status: "PENDING",
                periodMonth: monthKeyToDate(submittedMonth!),
              }
            : { enrollmentId, status: "PENDING" },
          select: { id: true },
        });
        if (pending) throw new DuplicatePendingError();
```

Update the `DuplicatePendingError` catch message to match the guard's wording:

```ts
    if (err instanceof DuplicatePendingError) {
      return {
        error: isMonthly
          ? "You already have a payment for this month awaiting review."
          : "You already have a payment awaiting review.",
      };
    }
```

Add the imports: `import { payableMonths } from "@/lib/payments/monthly";` and `import { monthKeyToDate } from "@/lib/time/manila";`.

- [ ] **Step 6: Add the picker to the form**

In `app/(student)/student/payments/[enrollmentId]/page.tsx`, compute the options and pass them down:

```tsx
import { selectableMonths } from "@/lib/payments/monthly";
import { peso } from "@/lib/payments/balance";
```

`peso` is imported here rather than in Task 9 because Task 9 renders amounts in this same file and the existing import line only brings in `describeBalance`.

```tsx
  const months =
    enrollment.course.paymentFrequency === "MONTHLY"
      ? selectableMonths(enrollment, enrollment.payments, new Date())
      : [];
```

`PaymentEnrollment.payments` already carries `amount`, `status`, and `periodMonth` from Task 4, so it satisfies `MatrixPayment` and passes straight through.

```tsx
        <PaymentForm enrollmentId={enrollment.id} months={months} />
```

In `payment-form.tsx`, add the prop and render the select above the amount field.
It is a plain `<select>`, matching the form's existing use of bare inputs rather than the shadcn Select, which is a client component with more machinery than this needs:

```tsx
import type { SelectableMonth } from "@/lib/payments/monthly";
import { peso } from "@/lib/payments/balance";

export function PaymentForm({
  enrollmentId,
  months,
}: {
  enrollmentId: string;
  months: SelectableMonth[];
}) {
```

```tsx
      {months.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="periodMonth">Paying For</Label>
          <select
            id="periodMonth"
            name="periodMonth"
            required
            defaultValue={months[0].key}
            className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {months.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
                {m.status.kind === "partial"
                  ? ` (${peso(m.status.short)} remaining)`
                  : ""}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-xs">
            This course is billed monthly. Pick the month this payment covers.
          </p>
        </div>
      )}
```

- [ ] **Step 7: Verify**

Run: `pnpm vitest run lib/__tests__/` and `./node_modules/.bin/tsc --noEmit`
Expected: PASS, no type errors.

Run: `pnpm lint`
Expected: no new warnings.

- [ ] **Step 8: Commit**

```bash
git add lib/payments/schema.ts lib/payments/actions.ts lib/payments/monthly.ts \
  lib/payments/queries.ts "app/(student)/student/payments" \
  lib/__tests__/payments/monthly-submit.test.ts
git commit -m "feat: let students say which month a payment covers"
```

---

## Task 6: Admin matrix queries

**Files:**
- Create: `lib/payments/monthly-queries.ts`
- Test: `lib/__tests__/payments/monthly-queries.test.ts`

**Interfaces:**
- Consumes: `buildMonthlyMatrix`, `MonthlyMatrix`, `MatrixEnrollment` from `lib/payments/monthly`; `dateToMonthKey` from `lib/time/manila`; `ACTIVE_COURSE` from `lib/courses/archive`.
- Produces: `getMonthlyCourses(): Promise<{ id: string; title: string; tuitionFee: number | null }[]>`; `getCourseMonthlyMatrix(courseId: string, now?: Date): Promise<{ course: { id: string; title: string; tuitionFee: number | null }; matrix: MonthlyMatrix } | null>`.

Separate from `lib/payments/queries.ts`, which is already long enough that adding matrix assembly to it would make it unreadable in one sitting.

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/payments/monthly-queries.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    course: { findMany: vi.fn(), findFirst: vi.fn() },
    enrollment: { findMany: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import {
  getMonthlyCourses,
  getCourseMonthlyMatrix,
} from "@/lib/payments/monthly-queries";

const decimal = (n: number) => ({ toNumber: () => n });

describe("getMonthlyCourses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.course.findMany).mockResolvedValue([] as never);
  });

  it("lists only monthly, non-archived courses", async () => {
    await getMonthlyCourses();
    expect(db.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { paymentFrequency: "MONTHLY", archivedAt: null },
      }),
    );
  });

  it("does not filter on isPublished", async () => {
    // An unpublished course can still have enrolled students who owe money.
    // Hiding it would hide their arrears.
    await getMonthlyCourses();
    const call = vi.mocked(db.course.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(call.where).not.toHaveProperty("isPublished");
  });
});

describe("getCourseMonthlyMatrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.course.findFirst).mockResolvedValue({
      id: "c1",
      title: "Marhala 1",
      tuitionFee: decimal(1500),
    } as never);
    vi.mocked(db.enrollment.findMany).mockResolvedValue([] as never);
  });

  it("returns null for a course that is not billed monthly", async () => {
    vi.mocked(db.course.findFirst).mockResolvedValue(null as never);
    expect(await getCourseMonthlyMatrix("c1")).toBeNull();
  });

  it("selects only approved and pending payments", async () => {
    // Rejected payments are not money received and are not awaiting review,
    // so they say nothing about a month.
    await getCourseMonthlyMatrix("c1");
    const call = vi.mocked(db.enrollment.findMany).mock.calls[0][0] as {
      select: { payments: { where: unknown } };
    };
    expect(call.select.payments.where).toEqual({
      status: { in: ["APPROVED", "PENDING"] },
    });
  });

  it("includes removed enrollments so their arrears stay visible", async () => {
    // Staff surfaces deliberately do not apply ACTIVE_ENROLLMENT: admins
    // still see removed rows so the history stays auditable.
    await getCourseMonthlyMatrix("c1");
    const call = vi.mocked(db.enrollment.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(call.where).toEqual({ courseId: "c1" });
  });

  it("converts stored period dates back into month keys", async () => {
    vi.mocked(db.enrollment.findMany).mockResolvedValue([
      {
        id: "e1",
        enrolledAt: new Date("2026-09-01T09:00:00+08:00"),
        completedAt: null,
        removedAt: null,
        user: { firstName: "Aisha", lastName: "R", email: "a@x.c" },
        payments: [
          {
            amount: decimal(1500),
            periodMonth: new Date("2026-09-01T00:00:00.000Z"),
            status: "APPROVED",
          },
        ],
      },
    ] as never);
    const result = await getCourseMonthlyMatrix(
      "c1",
      new Date("2026-09-08T10:00:00+08:00"),
    );
    const cell = result!.matrix.rows[0].cells[0];
    expect(cell.owed && cell.status).toEqual({ kind: "paid", paid: 1500 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run lib/__tests__/payments/monthly-queries.test.ts`
Expected: FAIL, resolution error for `@/lib/payments/monthly-queries`.

- [ ] **Step 3: Write the implementation**

Create `lib/payments/monthly-queries.ts`:

```ts
// The database reads behind the admin monthly tracker. Kept out of
// ./queries.ts, which is already long enough that adding matrix assembly to
// it would make it unreadable in one sitting.

import { db } from "@/lib/db";
import {
  buildMonthlyMatrix,
  type MatrixEnrollment,
  type MonthlyMatrix,
} from "@/lib/payments/monthly";
import { dateToMonthKey } from "@/lib/time/manila";

export type MonthlyCourse = {
  id: string;
  title: string;
  tuitionFee: number | null;
};

// Deliberately not filtered on `isPublished`: an unpublished course can still
// have enrolled students who owe money, and hiding it would hide their
// arrears.
export async function getMonthlyCourses(): Promise<MonthlyCourse[]> {
  const rows = await db.course.findMany({
    where: { paymentFrequency: "MONTHLY", archivedAt: null },
    orderBy: [{ groupName: "asc" }, { level: "asc" }, { title: "asc" }],
    select: { id: true, title: true, tuitionFee: true },
  });
  return rows.map((c) => ({
    id: c.id,
    title: c.title,
    tuitionFee: c.tuitionFee?.toNumber() ?? null,
  }));
}

export async function getCourseMonthlyMatrix(
  courseId: string,
  now: Date = new Date(),
): Promise<{ course: MonthlyCourse; matrix: MonthlyMatrix } | null> {
  const course = await db.course.findFirst({
    where: { id: courseId, paymentFrequency: "MONTHLY", archivedAt: null },
    select: { id: true, title: true, tuitionFee: true },
  });
  if (!course) return null;

  const rows = await db.enrollment.findMany({
    // No ACTIVE_ENROLLMENT here. Staff surfaces deliberately keep removed
    // rows so the history stays auditable, and a removed student's unpaid
    // months are exactly what an admin needs to see.
    where: { courseId },
    select: {
      id: true,
      enrolledAt: true,
      completedAt: true,
      removedAt: true,
      user: { select: { firstName: true, lastName: true, email: true } },
      payments: {
        // Rejected payments are neither money received nor awaiting review,
        // so they say nothing about a month.
        where: { status: { in: ["APPROVED", "PENDING"] } },
        select: { amount: true, periodMonth: true, status: true },
      },
    },
  });

  const enrollments: MatrixEnrollment[] = rows.map((r) => ({
    id: r.id,
    enrolledAt: r.enrolledAt,
    completedAt: r.completedAt,
    removedAt: r.removedAt,
    student: r.user,
    payments: r.payments.map((p) => ({
      amount: p.amount.toNumber(),
      periodMonth: p.periodMonth ? dateToMonthKey(p.periodMonth) : null,
      status: p.status,
    })),
  }));

  const tuitionFee = course.tuitionFee?.toNumber() ?? null;
  return {
    course: { id: course.id, title: course.title, tuitionFee },
    matrix: buildMonthlyMatrix(enrollments, tuitionFee, now),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run lib/__tests__/payments/monthly-queries.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Typecheck and commit**

```bash
./node_modules/.bin/tsc --noEmit
git add lib/payments/monthly-queries.ts lib/__tests__/payments/monthly-queries.test.ts
git commit -m "feat: add monthly payment matrix queries"
```

---

## Task 7: Admin monthly tab

**Files:**
- Create: `app/(admin)/admin/payments/monthly/monthly-matrix.tsx`
- Modify: `app/(admin)/admin/payments/page.tsx`

**Interfaces:**
- Consumes: `getMonthlyCourses`, `getCourseMonthlyMatrix` from `lib/payments/monthly-queries`; `monthKeyShort`, `monthKeyLabel` from `lib/time/manila`; `peso` from `lib/payments/balance`.
- Produces: `<MonthlyMatrixTable matrix={...} monthlyFee={...} />`.

The Monthly view is a fourth tab on `/admin/payments` rather than a separate route, because admins reviewing payments are already on this page and a second top-level entry would split payment work across two places in the nav.

- [ ] **Step 1: Build the matrix table component**

Create `app/(admin)/admin/payments/monthly/monthly-matrix.tsx`:

```tsx
import { peso } from "@/lib/payments/balance";
import { monthKeyShort, monthKeyLabel } from "@/lib/time/manila";
import type { MonthlyMatrix, MonthCell } from "@/lib/payments/monthly";
import { cn } from "@/lib/utils";

// Status is carried in the cell's accessible name as well as its glyph, so it
// does not depend on telling a check from a cross.
function CellMark({ cell }: { cell: MonthCell }) {
  if (!cell.owed) {
    return (
      <span className="text-muted-foreground/40" aria-label="Not enrolled">
        ·
      </span>
    );
  }
  const { status } = cell;
  const pending = cell.hasPending ? ", payment awaiting review" : "";
  const label = `${monthKeyLabel(cell.month)}: `;
  if (status.kind === "paid") {
    return (
      <span className="font-semibold text-emerald-600" title={peso(status.paid)}>
        <span className="sr-only">{label}paid{pending}</span>
        <span aria-hidden="true">✓</span>
      </span>
    );
  }
  if (status.kind === "partial") {
    return (
      <span
        className="font-semibold text-amber-600"
        title={`${peso(status.paid)} paid, ${peso(status.short)} short`}
      >
        <span className="sr-only">
          {label}partial, {peso(status.short)} short{pending}
        </span>
        <span aria-hidden="true">◐</span>
      </span>
    );
  }
  if (status.kind === "unscored") {
    return (
      <span className="text-muted-foreground" title={peso(status.paid)}>
        <span className="sr-only">
          {label}
          {peso(status.paid)} received, course has no fee set
        </span>
        <span aria-hidden="true">{status.paid > 0 ? "•" : "·"}</span>
      </span>
    );
  }
  return (
    <span className={cn("font-semibold", cell.hasPending ? "text-sky-600" : "text-destructive")}>
      <span className="sr-only">{label}unpaid{pending}</span>
      <span aria-hidden="true">{cell.hasPending ? "⋯" : "✕"}</span>
    </span>
  );
}

export function MonthlyMatrixTable({
  matrix,
  monthlyFee,
}: {
  matrix: MonthlyMatrix;
  monthlyFee: number | null;
}) {
  if (matrix.rows.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        No students are enrolled in this course yet.
      </p>
    );
  }

  return (
    // The student column is sticky and the months scroll. A course running two
    // years produces twenty-four columns, and letting the page go sideways
    // pushes the names out of view, which is the one thing an admin needs.
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th
              scope="col"
              className="bg-muted text-muted-foreground sticky left-0 z-10 px-4 py-2 text-left text-xs font-medium tracking-wide uppercase"
            >
              Student
            </th>
            <th
              scope="col"
              className="text-muted-foreground px-3 py-2 text-right text-xs font-medium tracking-wide uppercase"
            >
              Unassigned
            </th>
            {matrix.months.map((m) => (
              <th
                key={m}
                scope="col"
                className="text-muted-foreground px-3 py-2 text-center text-xs font-medium tracking-wide uppercase"
                title={monthKeyLabel(m)}
              >
                {monthKeyShort(m)}
              </th>
            ))}
            <th
              scope="col"
              className="text-muted-foreground px-4 py-2 text-right text-xs font-medium tracking-wide uppercase"
            >
              Behind
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {matrix.rows.map((row) => (
            <tr key={row.enrollmentId} className="hover:bg-muted/50 transition-colors">
              <th
                scope="row"
                className="bg-background sticky left-0 z-10 px-4 py-2 text-left font-normal"
              >
                <p className="font-medium">
                  {row.studentName}
                  {row.removedAt && (
                    <span className="text-muted-foreground ml-2 text-xs font-normal">
                      removed
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground text-xs">{row.studentEmail}</p>
              </th>
              <td className="text-muted-foreground px-3 py-2 text-right text-xs">
                {row.unassigned > 0 ? peso(row.unassigned) : "—"}
              </td>
              {row.cells.map((cell) => (
                <td key={cell.month} className="px-3 py-2 text-center">
                  <CellMark cell={cell} />
                </td>
              ))}
              <td className="px-4 py-2 text-right whitespace-nowrap">
                {row.monthsBehind === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <span className="text-destructive font-medium">
                    {row.monthsBehind} {row.monthsBehind === 1 ? "month" : "months"}
                    {monthlyFee !== null && ` · ${peso(row.amountBehind)}`}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted/50 border-t">
          {(["paid", "partial", "unpaid"] as const).map((kind) => (
            <tr key={kind}>
              <th
                scope="row"
                className="bg-muted/50 text-muted-foreground sticky left-0 z-10 px-4 py-1.5 text-left text-xs font-medium capitalize"
              >
                {kind}
              </th>
              <td />
              {matrix.tallies.map((t) => (
                <td
                  key={t.month}
                  className="text-muted-foreground px-3 py-1.5 text-center text-xs"
                >
                  {t[kind]}
                </td>
              ))}
              <td />
            </tr>
          ))}
        </tfoot>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Add the tab to the payments page**

In `app/(admin)/admin/payments/page.tsx`:

Change the props type to carry the course selection:

```tsx
type Props = { searchParams: Promise<{ tab?: string; courseId?: string }> };
```

Add the imports:

```tsx
import { getMonthlyCourses, getCourseMonthlyMatrix } from "@/lib/payments/monthly-queries";
import { MonthlyMatrixTable } from "./monthly/monthly-matrix";
```

Immediately after `const { tab } = await searchParams;` becomes `const { tab, courseId } = await searchParams;`, branch before the existing status work:

```tsx
  if (tab === "monthly") {
    const courses = await getMonthlyCourses();
    const selectedId = courseId ?? courses[0]?.id;
    const result = selectedId ? await getCourseMonthlyMatrix(selectedId) : null;

    return (
      <div className="space-y-6 p-6">
        <PageHeader title="Payments" />
        <PaymentTabs active="monthly" countMap={await getPaymentStatusCounts()} />

        {courses.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-12">
            <Inbox className="h-8 w-8" aria-hidden="true" />
            <p className="text-sm">No courses are billed monthly.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {courses.map((c) => (
                <Button
                  key={c.id}
                  asChild
                  size="sm"
                  variant={c.id === selectedId ? "default" : "outline"}
                >
                  <Link href={`?tab=monthly&courseId=${c.id}`}>{c.title}</Link>
                </Button>
              ))}
            </div>

            {result && (
              <>
                <p className="text-muted-foreground text-sm">
                  {result.course.title} ·{" "}
                  {result.course.tuitionFee === null ? (
                    <span className="text-amber-600">
                      No monthly fee set for this course, so months cannot be
                      marked paid or unpaid. Set a tuition fee on the course to
                      enable tracking.
                    </span>
                  ) : (
                    `${peso(result.course.tuitionFee)} / month`
                  )}
                </p>
                <MonthlyMatrixTable
                  matrix={result.matrix}
                  monthlyFee={result.course.tuitionFee}
                />
              </>
            )}
          </>
        )}
      </div>
    );
  }
```

The tab strip is currently inline JSX and is now needed by two branches, so extract it.
Add this above `AdminPaymentsPage` in the same file, delete the existing `tabs` array and its inline `<div className="-mt-2 flex gap-1 border-b">` block, and render `<PaymentTabs active={tab ?? "pending"} countMap={countMap} />` in its place:

```tsx
const TABS = [
  { label: "Pending", value: "pending", enumStatus: "PENDING" as const },
  { label: "Approved", value: "approved", enumStatus: "APPROVED" as const },
  { label: "Rejected", value: "rejected", enumStatus: "REJECTED" as const },
  // Monthly is a view, not a review queue, so it carries no count badge.
  { label: "Monthly", value: "monthly", enumStatus: null },
];

function PaymentTabs({
  active,
  countMap,
}: {
  active: string;
  countMap: Record<string, number>;
}) {
  return (
    <div className="-mt-2 flex gap-1 border-b">
      {TABS.map((t) => {
        const isActive = t.value === active;
        return (
          <Link
            key={t.value}
            href={`?tab=${t.value}`}
            className={cn(
              "flex items-center gap-1.5 px-4 pb-3 text-sm transition-colors",
              isActive
                ? "border-primary text-foreground border-b-2 font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.enumStatus && (
              <span className="bg-muted text-muted-foreground inline-block rounded px-1.5 py-0.5 text-xs font-medium">
                {countMap[t.enumStatus] ?? 0}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
```

The status branch currently derives `status` from `tab` through `STATUS_MAP` and passes `t.enumStatus === status` to decide the active tab.
`PaymentTabs` compares on `t.value` instead, so pass `tab ?? "pending"`: an unrecognised `tab` value falls back to the Pending query, and passing the raw value would leave no tab highlighted.
Guard that by normalising once: `const activeTab = tab && tab in { pending: 1, approved: 1, rejected: 1, monthly: 1 } ? tab : "pending";` and pass `activeTab`.

- [ ] **Step 3: Verify it renders**

Run: `pnpm build`
Expected: build succeeds with no type errors.

Then start the app and look at it, per the project's UI standard:

Run: `pnpm dev`
Visit `/admin/payments?tab=monthly` as an admin.
Check: the tab strip shows four tabs with Monthly active; course buttons render; the matrix has a sticky student column that stays put while the month columns scroll; the footer tallies line up under their columns; a course with no fee shows the amber warning and no paid/unpaid verdicts.

Fix anything that looks off, including alignment and spacing.
The tallies row misaligning with its columns is the most likely defect, since the footer has to account for both the Unassigned and Behind columns.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/admin/payments"
git commit -m "feat: add monthly payment matrix to the admin payments page"
```

---

## Task 8: Assign a month on review

**Files:**
- Modify: `app/(admin)/admin/payments/[id]/page.tsx`
- Modify: `app/(admin)/admin/payments/[id]/approve-form.tsx`
- Modify: `app/(admin)/admin/payments/[id]/actions.ts`
- Modify: `lib/payments/queries.ts` (`AdminPaymentDetail`, `getAdminPaymentById`)

**Interfaces:**
- Consumes: `payableMonths` from `lib/payments/monthly`; `monthKeyToDate`, `dateToMonthKey`, `monthKeyLabel` from `lib/time/manila`.
- Produces: `AdminPaymentDetail` gains `isMonthly: boolean`, `periodMonth: MonthKey | null`, and `monthOptions: { key: MonthKey; label: string }[]`.

This is what makes the Unassigned column actionable, and it is how an admin corrects a student who picked the wrong month.

- [ ] **Step 1: Extend the detail query**

In `lib/payments/queries.ts`, add to `AdminPaymentDetail`:

```ts
  // Monthly courses only. `periodMonth` is what the student picked, null for
  // a historical row predating the field; `monthOptions` is what the admin
  // may change it to.
  isMonthly: boolean;
  periodMonth: MonthKey | null;
  monthOptions: { key: MonthKey; label: string }[];
```

`monthOptions` carries no status: the approve form renders labels only, and the admin needs every payable month here, including ones already settled, so a wrong attribution can be corrected onto them.

Add `import { payableMonths } from "@/lib/payments/monthly";` and `monthKeyLabel` to the existing `@/lib/time/manila` import in `lib/payments/queries.ts`.

In `getAdminPaymentById`, add `periodMonth: true` to the payment's top-level select, and add `enrolledAt`, `completedAt`, `removedAt` to the enrollment select.
Then build the three fields:

```ts
  const isMonthly = r.enrollment.course.paymentFrequency === "MONTHLY";
  const monthOptions = isMonthly
    ? payableMonths(
        {
          enrolledAt: r.enrollment.enrolledAt,
          completedAt: r.enrollment.completedAt,
          removedAt: r.enrollment.removedAt,
        },
        new Date(),
      ).map((key) => ({ key, label: monthKeyLabel(key) }))
    : [];
```

`payableMonths`, not `selectableMonths`: this is the range an admin may choose from, not the subset still outstanding.
An admin correcting a wrong attribution needs to pick a month that is already settled.

- [ ] **Step 2: Render the month on the detail page and in the approve form**

In `app/(admin)/admin/payments/[id]/page.tsx`, add a row to the payment's detail list, alongside the amount:

```tsx
{payment.isMonthly && (
  <div>
    <dt className="text-muted-foreground text-xs uppercase">Covers</dt>
    <dd className="font-medium">
      {payment.periodMonth ? (
        monthKeyLabel(payment.periodMonth)
      ) : (
        <span className="text-amber-600">Not assigned to a month</span>
      )}
    </dd>
  </div>
)}
```

Match the surrounding markup in that file rather than copying this shape blindly; the point is the content, not the tags.
Import `monthKeyLabel` from `@/lib/time/manila` there.

`approve-form.tsx` is a client component, so pass the three new fields down as props from `page.tsx` where it already renders `<ApproveForm ... />`:
`isMonthly={payment.isMonthly} periodMonth={payment.periodMonth} monthOptions={payment.monthOptions}`, and add them to that component's props type as `isMonthly: boolean; periodMonth: string | null; monthOptions: { key: string; label: string }[]`.

In `approve-form.tsx`, add a select when `isMonthly`, defaulting to the payment's current month.
A pending payment on a monthly course must not be approvable without one:

```tsx
{isMonthly && (
  <div className="space-y-2">
    <Label htmlFor="periodMonth">Month this payment covers</Label>
    <select
      id="periodMonth"
      name="periodMonth"
      required
      defaultValue={periodMonth ?? ""}
      className="border-input bg-background h-10 w-full rounded-md border px-3 py-2 text-sm"
    >
      <option value="" disabled>
        Select a month
      </option>
      {monthOptions.map((m) => (
        <option key={m.key} value={m.key}>
          {m.label}
        </option>
      ))}
    </select>
    <p className="text-muted-foreground text-xs">
      Correct this if the student picked the wrong month. Historical payments
      have no month until you set one here.
    </p>
  </div>
)}
```

- [ ] **Step 3: Persist it in the approve action**

In `app/(admin)/admin/payments/[id]/actions.ts`, `approvePaymentAction` currently selects the enrollment's `course: { select: { title: true } }`.
Add `paymentFrequency: true` to that select, then after the existing validation:

```ts
  const isMonthly = payment.enrollment.course.paymentFrequency === "MONTHLY";
  const rawMonth = formData.get("periodMonth");
  const monthText = typeof rawMonth === "string" ? rawMonth.trim() : "";
  if (isMonthly && !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthText)) {
    return { error: "Select which month this payment covers." };
  }
  if (!isMonthly && monthText !== "") {
    return { error: "This course is not billed monthly." };
  }
```

Then include it in the `updateMany` that flips the payment to APPROVED, so attribution and approval are one atomic act rather than two:

```ts
        data: {
          status: "APPROVED",
          reviewedById: auth.userId,
          reviewedAt: new Date(),
          ...(isMonthly ? { periodMonth: monthKeyToDate(monthText) } : {}),
        },
```

Add `import { monthKeyToDate } from "@/lib/time/manila";` to that file.

Leave the existing `revalidatePath("/admin/payments")` call in place; it revalidates the whole route, monthly tab included.

- [ ] **Step 4: Verify**

Run: `pnpm vitest run lib/__tests__/` and `./node_modules/.bin/tsc --noEmit` and `pnpm build`
Expected: PASS, no type errors, build succeeds.

Then exercise it in the browser: approve a pending payment on a monthly course, confirm the approve form refuses to submit without a month, and confirm the matrix cell for that month turns paid.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/admin/payments/[id]" lib/payments/queries.ts
git commit -m "feat: let admins set the month a payment covers on review"
```

---

## Task 9: Student sees their own months

**Files:**
- Modify: `app/(student)/student/payments/[enrollmentId]/page.tsx`

**Interfaces:**
- Consumes: `selectableMonths` (already computed in Task 5), `monthStatus`, `peso`, `monthKeyLabel`.
- Produces: nothing other tasks depend on.

The spec flags this as the one piece that could be cut without breaking anything else.
The picker is required for the feature to work; this list is a convenience on top of it.
If the branch is running long, skip this task and say so.

- [ ] **Step 1: Render the month list above the form**

In `app/(student)/student/payments/[enrollmentId]/page.tsx`, between the balance line and `<PaymentForm>`:

```tsx
{months.length > 0 && (
  <div className="mt-4 rounded-lg border p-4">
    <h2 className="text-sm font-semibold">Your monthly payments</h2>
    <ul className="mt-2 space-y-1 text-sm">
      {months.map((m) => (
        <li key={m.key} className="flex justify-between gap-4">
          <span>{m.label}</span>
          <span
            className={
              m.status.kind === "partial" ? "text-amber-600" : "text-muted-foreground"
            }
          >
            {m.status.kind === "partial"
              ? `${peso(m.status.short)} remaining`
              : m.status.kind === "unscored"
                ? "—"
                : "Not yet paid"}
          </span>
        </li>
      ))}
    </ul>
  </div>
)}
```

`selectableMonths` already excludes fully paid months, so this list is exactly what the student still owes plus next month.

- [ ] **Step 2: Verify**

Run: `pnpm build`
Expected: succeeds.

Visit `/student/payments/<enrollmentId>` as a student enrolled in a monthly course.
Check the list matches the picker's options and the spacing matches the surrounding card.

- [ ] **Step 3: Commit**

```bash
git add "app/(student)/student/payments"
git commit -m "feat: show a student which months they still owe"
```

---

## Final verification

- [ ] **Run everything**

```bash
pnpm vitest run
./node_modules/.bin/tsc --noEmit
pnpm lint
pnpm build
```

All four must pass with no new failures or warnings.
If a pre-existing test is flaky or failing, fix it rather than working around it.

- [ ] **Walk the feature end to end in the browser**

1. As an admin, set a monthly course's tuition fee and confirm `/admin/payments?tab=monthly` lists it.
2. As a student on that course, submit a payment and pick a month.
3. As an admin, approve it and confirm the month is pre-selected from the student's choice.
4. Confirm the matrix cell turns paid and the column tally moves.
5. Submit a second payment for a different month without waiting, and confirm it is accepted.
6. Submit a second payment for the same month and confirm it is refused with "You already have a payment for this month awaiting review."
7. Confirm a one-time course's payment form shows no month picker and still works.
