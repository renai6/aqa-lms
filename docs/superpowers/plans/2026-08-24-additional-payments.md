# Additional Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a student with a `PARTIALLY_PAID` enrollment submit an additional payment with proof, and give admins a queue to approve or reject it.

**Architecture:** One new `Payment` model hanging off `Enrollment`, plus a `lib/payments/` module (schema, guard, queries, email, action) that mirrors the proven `lib/purchases/` module step for step.
Two pieces of UI that already exist in a purchase-only form get extracted first so both flows share one copy: the BPI/GCash instruction block and the admin proof-image viewer.
The student page and the server action both call one pure `canAddPayment` guard, so the eligibility rule is written and tested once.

**Tech Stack:** Next.js 16 (App Router, server actions), Prisma 7 against hosted Supabase Postgres, Zod 4, Vitest (node environment), Supabase Storage, Resend, Tailwind, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-08-23-additional-payments-design.md`

## Global Constraints

- Package manager is **pnpm**. Never `npm` or `yarn`.
- Migrations touch a **shared production Supabase database**. Never run `prisma migrate dev`, `migrate deploy`, or `migrate reset`. Task 1 hands that to the user. Never accept a proposed database reset - it means the branch is behind `origin/main`, not that the database is broken.
- `pnpm prisma generate` is safe and allowed. It reads the schema only.
- `app/generated/prisma/` is a stale, unused leftover. Never read it or trust it. The real client is `@prisma/client` in `node_modules`.
- Prettier config is `semi: true`, `singleQuote: false`, `trailingComma: "all"`, `printWidth: 80`. **All new files use semicolons and double quotes.** Some existing files (`lib/purchases/actions.ts`, `lib/student/queries.ts`, `app/(student)/student/checkout/page.tsx`) are unformatted with no semicolons and single quotes - when editing one of those, match the file you are in and do not reformat the rest of it.
- Format only the files you touched: `./node_modules/.bin/prettier --write <paths>`. Never run `pnpm format` (it rewrites the whole repo).
- Run tests with `./node_modules/.bin/vitest run <path>`. Run the type check with `./node_modules/.bin/tsc --noEmit`.
- The new model is named exactly `Payment`, its money column is `amount`, and its proof column is `proofUrl`. Not `PaymentSubmission`, not `amountPaid`, not `paymentProofUrl`.
- `Payment.status` reuses the existing `EnrollmentStatus` enum (`PENDING` / `APPROVED` / `REJECTED`). Do not add a new enum.
- `Payment` has no `paymentStatus` column. `PARTIALLY_PAID` / `FULLY_PAID` lives on `Enrollment` only.
- Storage path is exactly `payment/{paymentId}/proof.{ext}` in the bucket named by `process.env.SUPABASE_STORAGE_BUCKET`.
- No balance math anywhere. The system never sums payments against a tuition fee and never decides that a student is fully paid. The admin chooses the resulting status explicitly.
- Do not backfill existing `Purchase` rows into `Payment`, and do not modify the checkout or purchase-approval flows beyond the two extractions in Tasks 2 and 3.
- Every mocked test mocks `@/lib/db`. Mocked tests cannot prove a column exists - `tsc --noEmit` against the generated client is what proves that.
- The "no pending payment" rule is a read-then-write, so two tabs submitting at once can create two pending rows. **This race is accepted deliberately.** Do not add a partial unique index, an advisory lock, or a serializable transaction to close it. The admin sees two rows and rejects one.

---

### Task 1: Add the Payment model and apply the migration

The whole feature is blocked on the table existing and the Prisma client knowing about it.
This task ends when `tsc --noEmit` compiles against a client that has `db.payment`.

**Files:**
- Modify: `prisma/schema.prisma` (add `Payment` model after `PurchaseItem`, add two back-relations)

**Interfaces:**
- Consumes: nothing.
- Produces: `db.payment` on the Prisma client, with fields `id`, `enrollmentId`, `enrollment`, `amount` (Decimal), `proofUrl` (String), `status` (EnrollmentStatus, default PENDING), `adminRemarks` (String?), `reviewedById` (String?), `reviewedBy` (User?), `reviewedAt` (DateTime?), `createdAt`, `updatedAt`. Also `Enrollment.payments` and `User.reviewedPayments`.

- [x] **Step 1: Add the model to the schema**

In `prisma/schema.prisma`, immediately after the `PurchaseItem` model (it ends around line 360, just before the `// ASSESSMENTS` banner), add:

```prisma
// A student-submitted payment made after checkout, against one enrollment.
// `status` reuses EnrollmentStatus (PENDING/APPROVED/REJECTED) exactly as
// Purchase.status does. The resulting PARTIALLY_PAID/FULLY_PAID value is not
// stored here - it lives on Enrollment, and the admin picks it on approval.
model Payment {
  id           String           @id @default(cuid())
  enrollmentId String
  enrollment   Enrollment       @relation(fields: [enrollmentId], references: [id])
  amount       Decimal
  proofUrl     String
  status       EnrollmentStatus @default(PENDING)
  adminRemarks String?
  reviewedById String?
  reviewedBy   User?            @relation("ReviewedPayments", fields: [reviewedById], references: [id])
  reviewedAt   DateTime?
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  @@index([enrollmentId])
  @@index([status])
}
```

- [x] **Step 2: Add the two back-relations**

In `model User` (around line 136), after the `reviewedPurchases` line, add:

```prisma
  reviewedPayments   Payment[]           @relation("ReviewedPayments")
```

In `model Enrollment` (around line 314), after the `batch` line and before the `@@unique`, add:

```prisma
  payments Payment[]
```

- [x] **Step 3: Verify the schema is valid**

Run: `pnpm prisma validate`
Expected: "The schema at prisma/schema.prisma is valid."

- [x] **Step 4: Hand the migration to the user**

Stop and tell the user, verbatim:

> The schema change is in. Please run this in your own terminal, then tell me when it finishes:
>
> `pnpm prisma migrate dev --name add_payment`
>
> If it reports drift or proposes a reset, do not accept - that means this branch is behind `origin/main`. Sync with main and re-run.

Wait for the user. Do not proceed on your own.

- [x] **Step 5: Regenerate the client**

Run: `pnpm prisma generate`
Expected: "Generated Prisma Client".

Then confirm the migration folder exists:
Run: `ls prisma/migrations | tail -3`
Expected: a new `*_add_payment` folder.

- [x] **Step 6: Prove the client has the model**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no output (exit 0).

- [x] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add Payment model for student additional payments"
```

---

### Task 2: Extract the shared payment instructions block

The BPI and GCash account details are hard-coded inside the checkout form.
The new student payment page needs the identical block, so extract it before there is a second copy to drift from.
This is a pure refactor: checkout must render exactly the same markup afterwards.

**Files:**
- Create: `components/payment-instructions.tsx`
- Modify: `app/(student)/student/checkout/checkout-form.tsx` (replace the instruction block with the component, add the import)

**Interfaces:**
- Consumes: nothing.
- Produces: `PaymentInstructions` (no props) exported from `@/components/payment-instructions`.

- [x] **Step 1: Create the component**

Create `components/payment-instructions.tsx` with the block lifted verbatim out of `checkout-form.tsx`:

```tsx
// The BPI and GCash account details shown wherever a student is asked to pay
// offline: checkout, and the additional-payment page. One copy, so the account
// numbers cannot drift apart.
export function PaymentInstructions() {
  return (
    <div className="bg-muted/40 space-y-4 rounded-xl border p-4">
      <div>
        <h2 className="text-foreground text-sm font-semibold">
          Where to send your payment
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Pay via bank transfer or GCash, then upload your proof of payment
          below.
        </p>
      </div>

      <div className="border-primary/25 bg-secondary space-y-1 rounded-lg border p-3">
        <p className="text-primary text-xs font-semibold tracking-wide uppercase">
          BPI
        </p>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Account Name</span>
          <span className="text-foreground text-right font-medium">
            AQA-Online Islamic School
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Account Number</span>
          <span className="text-foreground text-right font-medium tabular-nums">
            2129356823
          </span>
        </div>
      </div>

      <div className="space-y-1 rounded-lg border border-[#2a6fb0]/25 bg-[#e6f0fa] p-3">
        <p className="text-xs font-semibold tracking-wide text-[#1e5a94] uppercase">
          GCash
        </p>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Number</span>
          <span className="text-foreground text-right font-medium tabular-nums">
            09970767501
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Name</span>
          <span className="text-foreground text-right font-medium">
            Malihah M.
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [x] **Step 2: Use it in the checkout form**

In `app/(student)/student/checkout/checkout-form.tsx`, add the import next to the other component imports:

```tsx
import { PaymentInstructions } from "@/components/payment-instructions";
```

Then delete the whole `<div className="bg-muted/40 space-y-4 rounded-xl border p-4">` block (it starts right after the totals card and ends just before `<input type="hidden" name="paymentType" value="PARTIAL" />`) and replace it with:

```tsx
      <PaymentInstructions />
```

- [x] **Step 3: Verify nothing broke**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no output.

Run: `pnpm lint`
Expected: no errors.

- [x] **Step 4: Format and commit**

```bash
./node_modules/.bin/prettier --write components/payment-instructions.tsx "app/(student)/student/checkout/checkout-form.tsx"
git add components/payment-instructions.tsx "app/(student)/student/checkout/checkout-form.tsx"
git commit -m "refactor: extract shared payment instructions component"
```

---

### Task 3: Generalize the admin proof image component

`ProofImage` hard-codes `/api/admin/purchases/${purchaseId}/proof`.
The payment detail page needs the same component pointed at a different route, so give it a `src` prop and move it somewhere both pages can import from.
Pure refactor: purchases must behave identically.

**Files:**
- Create: `components/admin/proof-image.tsx`
- Delete: `app/(admin)/admin/purchases/[id]/proof-image.tsx`
- Modify: `app/(admin)/admin/purchases/[id]/page.tsx` (import path and prop)

**Interfaces:**
- Consumes: nothing.
- Produces: `ProofImage({ src }: { src: string })` exported from `@/components/admin/proof-image`. `src` is the API route that returns `{ signedUrl }`.

- [x] **Step 1: Create the generalized component**

Create `components/admin/proof-image.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

// Fetches a short-lived signed URL from an admin proof route and renders it.
// `src` is the route to call, so purchases and payments share one component.
export function ProofImage({ src }: { src: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(src)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (active) setUrl(d.signedUrl);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [src]);

  if (error)
    return (
      <p className="text-muted-foreground text-sm">Could not load proof image.</p>
    );
  if (!url) return <div className="bg-muted h-48 animate-pulse rounded-lg" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Payment proof" className="max-h-96 rounded-lg border" />;
}
```

- [x] **Step 2: Point the purchase detail page at it**

In `app/(admin)/admin/purchases/[id]/page.tsx`, replace:

```tsx
import { ProofImage } from "./proof-image";
```

with:

```tsx
import { ProofImage } from "@/components/admin/proof-image";
```

and replace:

```tsx
        <ProofImage purchaseId={purchase.id} />
```

with:

```tsx
        <ProofImage src={`/api/admin/purchases/${purchase.id}/proof`} />
```

- [x] **Step 3: Delete the old component**

```bash
rm "app/(admin)/admin/purchases/[id]/proof-image.tsx"
```

- [x] **Step 4: Verify no other importer exists**

Run: `grep -rn "proof-image" app components`
Expected: only `app/(admin)/admin/purchases/[id]/page.tsx` importing from `@/components/admin/proof-image`.

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no output.

- [x] **Step 5: Commit**

```bash
./node_modules/.bin/prettier --write components/admin/proof-image.tsx "app/(admin)/admin/purchases/[id]/page.tsx"
git add -A components/admin "app/(admin)/admin/purchases/[id]"
git commit -m "refactor: generalize admin ProofImage to take a src prop"
```

---

### Task 4: The payment input schema

**Files:**
- Create: `lib/payments/schema.ts`
- Create: `lib/__tests__/payments/schema.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `createPaymentSchema` and `type CreatePaymentInput = { enrollmentId: string; amount: number }` from `@/lib/payments/schema`.

- [x] **Step 1: Write the failing test**

Create `lib/__tests__/payments/schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createPaymentSchema } from "@/lib/payments/schema";
import { validateImageUpload } from "@/lib/uploads/image";

describe("createPaymentSchema", () => {
  const base = { enrollmentId: "e1", amount: 1500 };

  it("accepts a positive amount", () => {
    expect(createPaymentSchema.safeParse(base).success).toBe(true);
  });

  it("coerces a numeric string from the form body", () => {
    const r = createPaymentSchema.safeParse({ ...base, amount: "1500" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.amount).toBe(1500);
  });

  it("rejects a zero amount", () => {
    const r = createPaymentSchema.safeParse({ ...base, amount: 0 });
    expect(r.success).toBe(false);
  });

  it("rejects a negative amount", () => {
    const r = createPaymentSchema.safeParse({ ...base, amount: -100 });
    expect(r.success).toBe(false);
  });

  it("rejects a non-numeric amount", () => {
    const r = createPaymentSchema.safeParse({ ...base, amount: "abc" });
    expect(r.success).toBe(false);
  });

  it("requires an enrollment id", () => {
    const r = createPaymentSchema.safeParse({ ...base, enrollmentId: "" });
    expect(r.success).toBe(false);
  });
});

// The proof image is not part of the zod schema - it is a File, validated by
// the shared uploader. This pins the "proof is required" half of the contract.
describe("proof of payment is required", () => {
  it("rejects a missing file", async () => {
    const r = await validateImageUpload(null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Please select a file to upload.");
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

Run: `./node_modules/.bin/vitest run lib/__tests__/payments/schema.test.ts`
Expected: FAIL, cannot resolve `@/lib/payments/schema`.

- [x] **Step 3: Write the schema**

Create `lib/payments/schema.ts`:

```ts
import { z } from "zod";

export const createPaymentSchema = z.object({
  enrollmentId: z.string().min(1, "Enrollment is required."),
  amount: z.coerce.number().positive("Amount must be greater than 0."),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
```

- [x] **Step 4: Run the tests**

Run: `./node_modules/.bin/vitest run lib/__tests__/payments/schema.test.ts`
Expected: PASS, 7 tests.

- [x] **Step 5: Commit**

```bash
./node_modules/.bin/prettier --write lib/payments/schema.ts lib/__tests__/payments/schema.test.ts
git add lib/payments/schema.ts lib/__tests__/payments/schema.test.ts
git commit -m "feat: add createPaymentSchema"
```

---

### Task 5: The eligibility guard

The student page and the server action must apply the same four conditions.
Extract them as one pure function so the rule is tested once and cannot drift.

**Files:**
- Create: `lib/payments/guards.ts`
- Create: `lib/__tests__/payments/guards.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces from `@/lib/payments/guards`:
  - `type GuardEnrollment = { paymentStatus: "PARTIALLY_PAID" | "FULLY_PAID"; course: { archivedAt: Date | null } }`
  - `type GuardPayment = { status: "PENDING" | "APPROVED" | "REJECTED" }`
  - `type GuardResult = { ok: true } | { ok: false; reason: string }`
  - `canAddPayment(enrollment: GuardEnrollment | null, payments: GuardPayment[]): GuardResult`
- Ownership is not a parameter: callers look the enrollment up scoped to the session user, so a foreign enrollment arrives here as `null`.

- [x] **Step 1: Write the failing test**

Create `lib/__tests__/payments/guards.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { canAddPayment } from "@/lib/payments/guards";

const active = { paymentStatus: "PARTIALLY_PAID" as const, course: { archivedAt: null } };

describe("canAddPayment", () => {
  it("allows a partially paid enrollment in an active course with no payments", () => {
    expect(canAddPayment(active, [])).toEqual({ ok: true });
  });

  it("allows a new payment after the last one was rejected", () => {
    expect(canAddPayment(active, [{ status: "REJECTED" }])).toEqual({ ok: true });
  });

  it("allows a new payment after an earlier one was approved", () => {
    expect(canAddPayment(active, [{ status: "APPROVED" }])).toEqual({ ok: true });
  });

  it("refuses when the enrollment does not exist or is not the student's", () => {
    const r = canAddPayment(null, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("Enrollment not found.");
  });

  it("refuses when the enrollment is already fully paid", () => {
    const r = canAddPayment({ ...active, paymentStatus: "FULLY_PAID" }, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("This enrollment is already fully paid.");
  });

  it("refuses when the course is archived", () => {
    const r = canAddPayment(
      { ...active, course: { archivedAt: new Date() } },
      [],
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("This course is no longer available.");
  });

  it("refuses when a payment is already awaiting review", () => {
    const r = canAddPayment(active, [{ status: "REJECTED" }, { status: "PENDING" }]);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.reason).toBe("You already have a payment awaiting review.");
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

Run: `./node_modules/.bin/vitest run lib/__tests__/payments/guards.test.ts`
Expected: FAIL, cannot resolve `@/lib/payments/guards`.

- [x] **Step 3: Write the guard**

Create `lib/payments/guards.ts`:

```ts
// The single rule for whether a student may submit an additional payment.
// The page uses it to decide whether to render, the action uses it to decide
// whether to accept - a page check alone is advisory, since a stale tab can
// post to the action directly.
export type GuardEnrollment = {
  paymentStatus: "PARTIALLY_PAID" | "FULLY_PAID";
  course: { archivedAt: Date | null };
};

export type GuardPayment = { status: "PENDING" | "APPROVED" | "REJECTED" };

export type GuardResult = { ok: true } | { ok: false; reason: string };

export function canAddPayment(
  enrollment: GuardEnrollment | null,
  payments: GuardPayment[],
): GuardResult {
  if (!enrollment) return { ok: false, reason: "Enrollment not found." };
  if (enrollment.paymentStatus === "FULLY_PAID") {
    return { ok: false, reason: "This enrollment is already fully paid." };
  }
  if (enrollment.course.archivedAt !== null) {
    return { ok: false, reason: "This course is no longer available." };
  }
  if (payments.some((p) => p.status === "PENDING")) {
    return { ok: false, reason: "You already have a payment awaiting review." };
  }
  return { ok: true };
}
```

- [x] **Step 4: Run the tests**

Run: `./node_modules/.bin/vitest run lib/__tests__/payments/guards.test.ts`
Expected: PASS, 7 tests.

- [x] **Step 5: Commit**

```bash
./node_modules/.bin/prettier --write lib/payments/guards.ts lib/__tests__/payments/guards.test.ts
git add lib/payments/guards.ts lib/__tests__/payments/guards.test.ts
git commit -m "feat: add canAddPayment eligibility guard"
```

---

### Task 6: Payment emails

Three transactional emails, mirroring `lib/purchases/email.ts` exactly in tone and structure.
Deliberately no amounts in the copy: `amount` is a Prisma `Decimal`, and keeping it out of the email keeps every caller free of Decimal conversion.

**Files:**
- Create: `lib/payments/email.ts`

**Interfaces:**
- Consumes: nothing.
- Produces from `@/lib/payments/email`:
  - `sendPaymentConfirmationEmail(params: { to: string; firstName: string; courseTitle: string }): Promise<void>`
  - `sendPaymentApprovalEmail(params: { to: string; firstName: string; courseTitle: string; paymentStatus: "PARTIALLY_PAID" | "FULLY_PAID" }): Promise<void>`
  - `sendPaymentRejectionEmail(params: { to: string; firstName: string; courseTitle: string; reason: string }): Promise<void>`
- Each throws on a Resend error. Callers catch, log, and treat it as non-fatal.

- [x] **Step 1: Write the module**

Create `lib/payments/email.ts`:

```ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendPaymentConfirmationEmail(params: {
  to: string;
  firstName: string;
  courseTitle: string;
}): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/student/dashboard`;
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.to,
    subject: "We received your payment — Al-Qur'an Academy",
    html: `<p>Assalamualaykum ${escapeHtml(params.firstName)},</p>
<p>We have received your payment and proof of payment for <strong>${escapeHtml(params.courseTitle)}</strong>. Our team will review it shortly.</p>
<p>You can track its status here: <a href="${url}">${url}</a></p>
<p>Best regards,<br>Al-Qur'an Academy Team</p>`,
  });
  if (error)
    throw new Error(
      `Failed to send payment confirmation email: ${error.message}`,
    );
}

export async function sendPaymentApprovalEmail(params: {
  to: string;
  firstName: string;
  courseTitle: string;
  paymentStatus: "PARTIALLY_PAID" | "FULLY_PAID";
}): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/student/dashboard`;
  const statusLine =
    params.paymentStatus === "FULLY_PAID"
      ? "Your enrollment is now marked as fully paid. Jazakallahu khayran!"
      : "Your enrollment is still marked as partially paid, so a balance remains.";
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.to,
    subject: "Your payment is approved — Al-Qur'an Academy",
    html: `<p>Assalamualaykum ${escapeHtml(params.firstName)},</p>
<p>Your payment for <strong>${escapeHtml(params.courseTitle)}</strong> has been approved.</p>
<p>${statusLine}</p>
<p>View your dashboard: <a href="${url}">${url}</a></p>
<p>Best regards,<br>Al-Qur'an Academy Team</p>`,
  });
  if (error)
    throw new Error(`Failed to send payment approval email: ${error.message}`);
}

export async function sendPaymentRejectionEmail(params: {
  to: string;
  firstName: string;
  courseTitle: string;
  reason: string;
}): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/student/dashboard`;
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.to,
    subject: "Update on your payment — Al-Qur'an Academy",
    html: `<p>Assalamualaykum ${escapeHtml(params.firstName)},</p>
<p>Unfortunately, your recent payment for <strong>${escapeHtml(params.courseTitle)}</strong> could not be approved.</p>
<p><strong>Reason:</strong> ${escapeHtml(params.reason)}</p>
<p>You're welcome to submit a new payment here: <a href="${url}">${url}</a></p>
<p>Best regards,<br>Al-Qur'an Academy Team</p>`,
  });
  if (error)
    throw new Error(`Failed to send payment rejection email: ${error.message}`);
}
```

- [x] **Step 2: Verify it compiles**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no output.

- [x] **Step 3: Commit**

```bash
./node_modules/.bin/prettier --write lib/payments/email.ts
git add lib/payments/email.ts
git commit -m "feat: add payment notification emails"
```

---

### Task 7: Payment queries

Every read the feature needs, in one module: the student page's lookup, the dashboard's per-enrollment state, and the three admin reads.

**Files:**
- Create: `lib/payments/queries.ts`

**Interfaces:**
- Consumes: `GuardEnrollment` / `GuardPayment` shapes from Task 5 (the returned `PaymentEnrollment` is assignable to `GuardEnrollment`).
- Produces from `@/lib/payments/queries`:
  - `getEnrollmentForPayment(userId: string, enrollmentId: string): Promise<PaymentEnrollment | null>`
  - `getEnrollmentPaymentStates(userId: string): Promise<Record<string, EnrollmentPaymentState>>` keyed by enrollment id
  - `getAdminPaymentsByStatus(status: EnrollmentStatus): Promise<AdminPaymentRow[]>`
  - `getPaymentStatusCounts(): Promise<Record<string, number>>`
  - `getAdminPaymentById(id: string): Promise<AdminPaymentDetail | null>`

- [x] **Step 1: Write the module**

Create `lib/payments/queries.ts`:

```ts
import { db } from "@/lib/db";
import type { EnrollmentStatus, PaymentStatus } from "@prisma/client";

export type PaymentEnrollment = {
  id: string;
  paymentStatus: PaymentStatus;
  course: { title: string; archivedAt: Date | null };
  // Only `status` is selected: the guard asks whether one is PENDING, and
  // nothing on this page needs the rest. The dashboard's richer per-enrollment
  // state comes from getEnrollmentPaymentStates below.
  payments: { status: EnrollmentStatus }[];
};

// Scoped by userId, so another student's enrollment simply comes back null and
// the guard reports it as not found.
export async function getEnrollmentForPayment(
  userId: string,
  enrollmentId: string,
): Promise<PaymentEnrollment | null> {
  return db.enrollment.findFirst({
    where: { id: enrollmentId, userId },
    select: {
      id: true,
      paymentStatus: true,
      course: { select: { title: true, archivedAt: true } },
      payments: { select: { status: true } },
    },
  });
}

export type EnrollmentPaymentState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "rejected"; reason: string | null };

// The dashboard's Payment section renders one of three states per enrollment,
// decided by that enrollment's most recent payment.
export async function getEnrollmentPaymentStates(
  userId: string,
): Promise<Record<string, EnrollmentPaymentState>> {
  const rows = await db.payment.findMany({
    where: { enrollment: { userId } },
    orderBy: { createdAt: "desc" },
    select: { enrollmentId: true, status: true, adminRemarks: true },
  });

  const states: Record<string, EnrollmentPaymentState> = {};
  for (const row of rows) {
    // Rows are newest first, so the first one seen for an enrollment wins.
    if (states[row.enrollmentId]) continue;
    if (row.status === "PENDING") {
      states[row.enrollmentId] = { kind: "pending" };
    } else if (row.status === "REJECTED") {
      states[row.enrollmentId] = { kind: "rejected", reason: row.adminRemarks };
    } else {
      states[row.enrollmentId] = { kind: "idle" };
    }
  }
  return states;
}

export type AdminPaymentRow = {
  id: string;
  status: EnrollmentStatus;
  amount: number;
  createdAt: Date;
  studentName: string;
  studentEmail: string;
  courseTitle: string;
};

export async function getAdminPaymentsByStatus(
  status: EnrollmentStatus,
): Promise<AdminPaymentRow[]> {
  const rows = await db.payment.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      amount: true,
      createdAt: true,
      enrollment: {
        select: {
          user: { select: { firstName: true, lastName: true, email: true } },
          course: { select: { title: true } },
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    amount: r.amount.toNumber(),
    createdAt: r.createdAt,
    studentName: `${r.enrollment.user.firstName} ${r.enrollment.user.lastName}`,
    studentEmail: r.enrollment.user.email,
    courseTitle: r.enrollment.course.title,
  }));
}

export async function getPaymentStatusCounts(): Promise<
  Record<string, number>
> {
  const grouped = await db.payment.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  return Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
}

export type AdminPaymentDetail = {
  id: string;
  status: EnrollmentStatus;
  amount: number;
  adminRemarks: string | null;
  createdAt: Date;
  enrollmentPaymentStatus: PaymentStatus;
  student: {
    firstName: string;
    lastName: string;
    email: string;
    contactNumber: string | null;
  };
  courseTitle: string;
};

export async function getAdminPaymentById(
  id: string,
): Promise<AdminPaymentDetail | null> {
  const r = await db.payment.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      amount: true,
      adminRemarks: true,
      createdAt: true,
      enrollment: {
        select: {
          paymentStatus: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              contactNumber: true,
            },
          },
          course: { select: { title: true } },
        },
      },
    },
  });
  if (!r) return null;
  return {
    id: r.id,
    status: r.status,
    amount: r.amount.toNumber(),
    adminRemarks: r.adminRemarks,
    createdAt: r.createdAt,
    enrollmentPaymentStatus: r.enrollment.paymentStatus,
    student: r.enrollment.user,
    courseTitle: r.enrollment.course.title,
  };
}
```

- [x] **Step 2: Verify it compiles against the real client**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no output. A failure here means Task 1's migration or `prisma generate` did not land.

- [x] **Step 3: Commit**

```bash
./node_modules/.bin/prettier --write lib/payments/queries.ts
git add lib/payments/queries.ts
git commit -m "feat: add payment queries"
```

---

### Task 8: The student submit action

Follows `createPurchaseAction` step for step, including the orphan-row cleanup when the upload fails.

**Files:**
- Create: `lib/payments/actions.ts`

**Interfaces:**
- Consumes: `createPaymentSchema` (Task 4), `canAddPayment` (Task 5), `sendPaymentConfirmationEmail` (Task 6), `getEnrollmentForPayment` (Task 7).
- Produces: `createPaymentAction(_prev: { error: string | null }, formData: FormData): Promise<{ error: string | null }>` from `@/lib/payments/actions`. Reads `enrollmentId`, `amount`, and `file` from the form. Redirects to `/student/dashboard?payment=1` on success.

- [x] **Step 1: Write the action**

Create `lib/payments/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateImageUpload } from "@/lib/uploads/image";
import { createPaymentSchema } from "@/lib/payments/schema";
import { canAddPayment } from "@/lib/payments/guards";
import { getEnrollmentForPayment } from "@/lib/payments/queries";
import { sendPaymentConfirmationEmail } from "@/lib/payments/email";

type ActionState = { error: string | null };

export async function createPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") return { error: "Unauthorized" };

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { email: true, firstName: true, isActive: true },
  });
  if (!user) return { error: "Account not found." };
  if (!user.isActive) return { error: "Your account is inactive." };

  const result = createPaymentSchema.safeParse({
    enrollmentId: formData.get("enrollmentId"),
    amount: formData.get("amount"),
  });
  if (!result.success)
    return { error: result.error.issues[0]?.message ?? "Validation failed." };
  const { enrollmentId, amount } = result.data;

  // The page ran this same check, but that check is advisory: a stale tab can
  // post here long after the enrollment stopped qualifying.
  const enrollment = await getEnrollmentForPayment(session.userId, enrollmentId);
  const allowed = canAddPayment(enrollment, enrollment?.payments ?? []);
  if (!allowed.ok) return { error: allowed.reason };
  // Unreachable - the guard already returned for a null enrollment. Present so
  // the compiler narrows `enrollment` for the rest of the action.
  if (!enrollment) return { error: "Enrollment not found." };

  const image = await validateImageUpload(formData.get("file"));
  if (!image.ok) return { error: image.error };

  let paymentId: string;
  try {
    const payment = await db.payment.create({
      data: {
        enrollmentId,
        amount,
        proofUrl: "", // set after upload
      },
      select: { id: true },
    });
    paymentId = payment.id;
  } catch (err) {
    console.error("[createPayment] DB error:", err);
    return { error: "A database error occurred. Please try again." };
  }

  const storagePath = `payment/${paymentId}/proof.${image.ext}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET!)
    .upload(storagePath, image.buffer, {
      contentType: image.contentType,
      upsert: true,
    });
  if (uploadError) {
    console.error("[createPayment] Supabase error:", uploadError);
    // Leave no pending row behind that the admin could never review.
    await db.payment.delete({ where: { id: paymentId } }).catch(() => {});
    return { error: "Failed to upload payment proof. Please try again." };
  }

  try {
    await db.payment.update({
      where: { id: paymentId },
      data: { proofUrl: storagePath },
    });
  } catch (err) {
    console.error("[createPayment] DB error (proof url):", err);
    return {
      error: "Payment uploaded but could not be saved. Please contact support.",
    };
  }

  try {
    await sendPaymentConfirmationEmail({
      to: user.email,
      firstName: user.firstName,
      courseTitle: enrollment.course.title,
    });
  } catch (err) {
    console.error("[createPayment] Email error:", err);
  }

  redirect("/student/dashboard?payment=1");
}
```

- [x] **Step 2: Verify it compiles**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no output.

Run: `pnpm lint`
Expected: no errors.

- [x] **Step 3: Commit**

```bash
./node_modules/.bin/prettier --write lib/payments/actions.ts
git add lib/payments/actions.ts
git commit -m "feat: add createPaymentAction"
```

---

### Task 9: The student payment page

**Files:**
- Create: `app/(student)/student/payments/[enrollmentId]/page.tsx`
- Create: `app/(student)/student/payments/[enrollmentId]/payment-form.tsx`

**Interfaces:**
- Consumes: `getEnrollmentForPayment` (Task 7), `canAddPayment` (Task 5), `createPaymentAction` (Task 8), `PaymentInstructions` (Task 2).
- Produces: the route `/student/payments/[enrollmentId]`, and `PaymentForm({ enrollmentId }: { enrollmentId: string })` local to the route folder.

- [x] **Step 1: Write the form**

Create `app/(student)/student/payments/[enrollmentId]/payment-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { createPaymentAction } from "@/lib/payments/actions";
import { PaymentInstructions } from "@/components/payment-instructions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export function PaymentForm({ enrollmentId }: { enrollmentId: string }) {
  const [state, formAction, isPending] = useActionState(createPaymentAction, {
    error: null,
  });

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="enrollmentId" value={enrollmentId} />

      <PaymentInstructions />

      <div className="space-y-2">
        <Label htmlFor="amount">Amount Paying Now (₱)</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          min="1"
          step="0.01"
          required
          placeholder="e.g. 5000"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="file">Proof of Payment</Label>
        <Input
          id="file"
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
        />
        <p className="text-muted-foreground text-xs">
          JPG, PNG, or WEBP. Max 10MB.
        </p>
      </div>

      {state.error && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg border px-4 py-3 text-sm"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="h-11 w-full font-semibold"
      >
        {isPending ? "Submitting…" : "Submit Payment"}
      </Button>
    </form>
  );
}
```

- [x] **Step 2: Write the page**

Create `app/(student)/student/payments/[enrollmentId]/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getEnrollmentForPayment } from "@/lib/payments/queries";
import { canAddPayment } from "@/lib/payments/guards";
import { PaymentForm } from "./payment-form";

export const metadata = { title: "Add Payment — AQA" };

type Props = { params: Promise<{ enrollmentId: string }> };

export default async function AddPaymentPage({ params }: Props) {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") redirect("/login");

  const { enrollmentId } = await params;
  const enrollment = await getEnrollmentForPayment(session.userId, enrollmentId);

  // Any failing condition sends the student back to where the button was.
  // The action re-checks all of this, so this redirect is convenience only.
  const allowed = canAddPayment(enrollment, enrollment?.payments ?? []);
  if (!allowed.ok || !enrollment) redirect("/student/dashboard");

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Add Payment</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        {enrollment.course.title}
      </p>
      <div className="mt-6">
        <PaymentForm enrollmentId={enrollment.id} />
      </div>
    </div>
  );
}
```

- [x] **Step 3: Verify it compiles**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no output.

Run: `pnpm lint`
Expected: no errors.

- [x] **Step 4: Commit**

```bash
./node_modules/.bin/prettier --write "app/(student)/student/payments/[enrollmentId]"/*.tsx
git add "app/(student)/student/payments"
git commit -m "feat: add student additional payment page"
```

---

### Task 10: Dashboard entry point and success banner

Each `PARTIALLY_PAID` row in the dashboard's Payment section gains one of three states, and a banner appears after a successful submission.

**Files:**
- Modify: `app/(student)/student/dashboard/page.tsx` (searchParams type, one extra query, the Payment section, one new banner)

**Interfaces:**
- Consumes: `getEnrollmentPaymentStates` (Task 7).
- Produces: links to `/student/payments/[enrollmentId]`, and handles `?payment=1`.

- [x] **Step 1: Add the import**

In `app/(student)/student/dashboard/page.tsx`, after the `getStudentDashboard` import, add:

```tsx
import { getEnrollmentPaymentStates } from "@/lib/payments/queries";
```

- [x] **Step 2: Read the new search param**

Replace:

```tsx
type Props = { searchParams: Promise<{ enrolled?: string }> };
```

with:

```tsx
type Props = { searchParams: Promise<{ enrolled?: string; payment?: string }> };
```

and replace:

```tsx
  const { enrolled } = await searchParams;
  const justEnrolled = enrolled === "1";
```

with:

```tsx
  const { enrolled, payment } = await searchParams;
  const justEnrolled = enrolled === "1";
  const justPaid = payment === "1";
```

- [x] **Step 3: Fetch the payment states**

Replace the destructured `Promise.all` block:

```tsx
  const [
    { enrollments, schedules, announcements, pendingPurchases },
    recentResults,
    user,
  ] = await Promise.all([
    getStudentDashboard(session.userId),
    getStudentRecentResults(session.userId),
    db.user.findUnique({
      where: { id: session.userId },
      select: { firstName: true },
    }),
  ]);
```

with:

```tsx
  const [
    { enrollments, schedules, announcements, pendingPurchases },
    recentResults,
    user,
    paymentStates,
  ] = await Promise.all([
    getStudentDashboard(session.userId),
    getStudentRecentResults(session.userId),
    db.user.findUnique({
      where: { id: session.userId },
      select: { firstName: true },
    }),
    getEnrollmentPaymentStates(session.userId),
  ]);
```

- [x] **Step 4: Add the success banner**

Directly after the closing `)}` of the `{justEnrolled && (...)}` block, add:

```tsx
      {/* Additional-payment success banner (shown right after submitting) */}
      {justPaid && (
        <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div className="space-y-1">
            <p className="font-semibold text-sm text-emerald-900">
              Your payment has been submitted for review.
            </p>
            <p className="text-sm text-emerald-700">
              Our admin team will verify your proof of payment. Your payment
              status here updates once it is approved.
            </p>
          </div>
        </div>
      )}
```

- [x] **Step 5: Rewrite the Payment section**

Replace the entire `{partialEnrollments.length > 0 && ( ... )}` section at the bottom of the file with:

```tsx
      {/* Payment summary */}
      {partialEnrollments.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">
            Payment
          </h2>
          <div className="space-y-2">
            {partialEnrollments.map((e) => {
              const state = paymentStates[e.id] ?? { kind: "idle" as const };
              return (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-4 rounded-xl bg-white border border-border shadow-sm px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground">
                      {e.course.title}
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Partial payment — balance outstanding
                    </p>
                    {state.kind === "rejected" && (
                      <p className="text-xs text-destructive mt-1">
                        Your last payment was rejected
                        {state.reason ? `: ${state.reason}` : "."}
                      </p>
                    )}
                  </div>
                  {state.kind === "pending" ? (
                    <span className="shrink-0 text-xs font-medium text-amber-600">
                      Payment under review
                    </span>
                  ) : (
                    <Button asChild size="sm" className="shrink-0">
                      <Link href={"/student/payments/" + e.id}>Add payment</Link>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
```

- [x] **Step 6: Verify**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no output.

Run: `pnpm lint`
Expected: no errors.

- [x] **Step 7: Commit**

```bash
./node_modules/.bin/prettier --write "app/(student)/student/dashboard/page.tsx"
git add "app/(student)/student/dashboard/page.tsx"
git commit -m "feat: add payment entry point to the student dashboard"
```

---

### Task 11: The admin proof route

A near-copy of the purchases proof route, reading `Payment.proofUrl`.
Written in the same no-semicolon style as the file it copies, so the two stay diff-able side by side.

**Files:**
- Create: `app/api/admin/payments/[id]/proof/route.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `GET /api/admin/payments/[id]/proof` returning `{ signedUrl }` (300-second TTL), or 401 / 403 / 404 / 500.

- [x] **Step 1: Write the route**

Create `app/api/admin/payments/[id]/proof/route.ts`:

```ts
import { type NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { verifySessionToken } from '@/lib/auth/jwt'
import { db } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params

  const token = req.cookies.get('session')?.value
  const payload = token ? await verifySessionToken(token) : null
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const payment = await db.payment.findUnique({ where: { id }, select: { proofUrl: true } })
  if (!payment || !payment.proofUrl) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error } = await supabaseAdmin.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET!)
    .createSignedUrl(payment.proofUrl, 300)
  if (error) {
    console.error('[payments/proof] Supabase signed URL error:', error)
    return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 })
  }

  return NextResponse.json({ signedUrl: data.signedUrl })
}
```

- [x] **Step 2: Verify it compiles**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no output.

- [x] **Step 3: Commit**

Do not run prettier on this file - it deliberately matches the unformatted style of the purchases route beside it.

```bash
git add "app/api/admin/payments"
git commit -m "feat: add admin payment proof route"
```

---

### Task 12: Admin approve and reject actions

The review side of the feature, with the concurrency guard and the single-transaction requirement the spec calls out.

**Files:**
- Create: `app/(admin)/admin/payments/[id]/actions.ts`
- Create: `lib/__tests__/payments/approve.test.ts`

**Interfaces:**
- Consumes: `sendPaymentApprovalEmail` / `sendPaymentRejectionEmail` (Task 6).
- Produces from `./actions` inside the route folder:
  - `approvePaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState>` - reads `id` and `paymentStatus` (`"PARTIALLY_PAID" | "FULLY_PAID"`)
  - `rejectPaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState>` - reads `id` and `reason`
  - `ActionState` is `{ error: string | null; success?: boolean }`. Declare it locally and do **not** export it: a `"use server"` file may only export async functions.

- [x] **Step 1: Write the failing test**

Create `lib/__tests__/payments/approve.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    payment: { findUnique: vi.fn(), updateMany: vi.fn() },
    enrollment: { update: vi.fn() },
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
vi.mock("@/lib/payments/email", () => ({
  sendPaymentApprovalEmail: vi.fn(),
  sendPaymentRejectionEmail: vi.fn(),
}));

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import {
  approvePaymentAction,
  rejectPaymentAction,
} from "@/app/(admin)/admin/payments/[id]/actions";

function approveForm(id: string, paymentStatus: string) {
  const f = new FormData();
  f.set("id", id);
  f.set("paymentStatus", paymentStatus);
  return f;
}

const paymentRow = {
  enrollmentId: "e1",
  enrollment: {
    course: { title: "Tajweed Basics" },
    user: { email: "s@example.com", firstName: "Sam" },
  },
};

describe("approvePaymentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      userId: "admin1",
      role: "ADMIN",
    } as never);
    // Run the transaction callback against a tx mock mirroring db, so the
    // logic inside the transaction actually executes.
    vi.mocked(db.$transaction).mockImplementation(
      ((cb: (tx: typeof db) => unknown) =>
        cb(db)) as unknown as typeof db.$transaction,
    );
    vi.mocked(db.payment.findUnique).mockResolvedValue(paymentRow as never);
  });

  it("marks the payment approved and sets the chosen enrollment status in one transaction", async () => {
    vi.mocked(db.payment.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.enrollment.update).mockResolvedValue({} as never);

    await expect(
      approvePaymentAction({ error: null }, approveForm("p1", "FULLY_PAID")),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p1", status: "PENDING" } }),
    );
    expect(db.enrollment.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { paymentStatus: "FULLY_PAID" },
    });
  });

  it("keeps the enrollment partially paid when the admin chooses that", async () => {
    vi.mocked(db.payment.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.enrollment.update).mockResolvedValue({} as never);

    await expect(
      approvePaymentAction({ error: null }, approveForm("p1", "PARTIALLY_PAID")),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(db.enrollment.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { paymentStatus: "PARTIALLY_PAID" },
    });
  });

  it("refuses a second approval and leaves the enrollment untouched", async () => {
    vi.mocked(db.payment.updateMany).mockResolvedValue({ count: 0 } as never);

    const result = await approvePaymentAction(
      { error: null },
      approveForm("p1", "FULLY_PAID"),
    );

    expect(result.error).toBe("This payment has already been processed.");
    expect(db.enrollment.update).not.toHaveBeenCalled();
  });

  it("requires an explicit resulting payment status", async () => {
    const f = new FormData();
    f.set("id", "p1");
    const result = await approvePaymentAction({ error: null }, f);

    expect(result.error).toBe("Please select the resulting payment status.");
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("rejectPaymentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      userId: "admin1",
      role: "ADMIN",
    } as never);
    vi.mocked(db.payment.findUnique).mockResolvedValue(paymentRow as never);
  });

  it("requires a reason", async () => {
    const f = new FormData();
    f.set("id", "p1");
    f.set("reason", "");

    const result = await rejectPaymentAction({ error: null }, f);

    expect(result.error).toBe("A reason is required.");
    expect(db.payment.updateMany).not.toHaveBeenCalled();
  });

  it("stores the reason in adminRemarks", async () => {
    vi.mocked(db.payment.updateMany).mockResolvedValue({ count: 1 } as never);
    const f = new FormData();
    f.set("id", "p1");
    f.set("reason", "Proof is unreadable.");

    await expect(rejectPaymentAction({ error: null }, f)).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(db.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "p1", status: "PENDING" },
        data: expect.objectContaining({
          status: "REJECTED",
          adminRemarks: "Proof is unreadable.",
        }),
      }),
    );
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

Run: `./node_modules/.bin/vitest run lib/__tests__/payments/approve.test.ts`
Expected: FAIL, cannot resolve `@/app/(admin)/admin/payments/[id]/actions`.

- [x] **Step 3: Write the actions**

Create `app/(admin)/admin/payments/[id]/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import {
  sendPaymentApprovalEmail,
  sendPaymentRejectionEmail,
} from "@/lib/payments/email";

type ActionState = { error: string | null; success?: boolean };

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { ok: false as const, error: "Unauthorized" };
  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
    return { ok: false as const, error: "Forbidden" };
  }
  return { ok: true as const, userId: session.userId };
}

export async function approvePaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Invalid payment ID." };

  // There is no balance math anywhere in this feature: the resulting payment
  // status is the admin's explicit choice, not something derived from sums.
  const statusResult = z
    .enum(["PARTIALLY_PAID", "FULLY_PAID"])
    .safeParse(formData.get("paymentStatus"));
  if (!statusResult.success)
    return { error: "Please select the resulting payment status." };
  const paymentStatus = statusResult.data;

  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const payment = await db.payment.findUnique({
    where: { id },
    select: {
      enrollmentId: true,
      enrollment: {
        select: {
          course: { select: { title: true } },
          user: { select: { email: true, firstName: true } },
        },
      },
    },
  });
  if (!payment) return { error: "Payment not found." };

  try {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      // updateMany + a PENDING filter is the concurrency guard: if another
      // admin got here first, count is 0 and nothing else in the tx runs.
      const updated = await tx.payment.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: "APPROVED",
          reviewedById: auth.userId,
          reviewedAt: new Date(),
        },
      });
      if (updated.count === 0) throw new Error("ALREADY_PROCESSED");

      await tx.enrollment.update({
        where: { id: payment.enrollmentId },
        data: { paymentStatus },
      });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "ALREADY_PROCESSED")
      return { error: "This payment has already been processed." };
    console.error("[approvePayment] Transaction error:", err);
    return { error: "A database error occurred. Please try again." };
  }

  revalidatePath("/admin/payments");

  try {
    await sendPaymentApprovalEmail({
      to: payment.enrollment.user.email,
      firstName: payment.enrollment.user.firstName,
      courseTitle: payment.enrollment.course.title,
      paymentStatus,
    });
  } catch (err) {
    console.error("[approvePayment] Email error:", err);
    return {
      error:
        "Payment approved but email delivery failed. Contact the student directly.",
      success: true,
    };
  }

  redirect("/admin/payments");
}

export async function rejectPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Invalid payment ID." };

  const reasonResult = z
    .string()
    .min(1, "A reason is required.")
    .safeParse(formData.get("reason"));
  if (!reasonResult.success)
    return {
      error: reasonResult.error.issues[0]?.message ?? "A reason is required.",
    };
  const reason = reasonResult.data;

  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const payment = await db.payment.findUnique({
    where: { id },
    select: {
      enrollment: {
        select: {
          course: { select: { title: true } },
          user: { select: { email: true, firstName: true } },
        },
      },
    },
  });
  if (!payment) return { error: "Payment not found." };

  let result: { count: number };
  try {
    result = await db.payment.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: "REJECTED",
        adminRemarks: reason,
        reviewedById: auth.userId,
        reviewedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("[rejectPayment] DB error:", err);
    return { error: "A database error occurred. Please try again." };
  }
  if (result.count === 0)
    return { error: "This payment has already been processed." };

  revalidatePath("/admin/payments");

  try {
    await sendPaymentRejectionEmail({
      to: payment.enrollment.user.email,
      firstName: payment.enrollment.user.firstName,
      courseTitle: payment.enrollment.course.title,
      reason,
    });
  } catch (err) {
    console.error("[rejectPayment] Email error:", err);
    return {
      error: "Payment rejected but notification email failed.",
      success: true,
    };
  }

  redirect("/admin/payments");
}
```

- [x] **Step 4: Run the tests**

Run: `./node_modules/.bin/vitest run lib/__tests__/payments/approve.test.ts`
Expected: PASS, 6 tests.

- [x] **Step 5: Run the whole suite and the type check**

Run: `./node_modules/.bin/vitest run`
Expected: all tests pass.

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no output.

- [x] **Step 6: Commit**

```bash
./node_modules/.bin/prettier --write "app/(admin)/admin/payments/[id]/actions.ts" lib/__tests__/payments/approve.test.ts
git add "app/(admin)/admin/payments" lib/__tests__/payments/approve.test.ts
git commit -m "feat: add admin payment approve and reject actions"
```

---

### Task 13: The admin payment queue

**Files:**
- Create: `app/(admin)/admin/payments/page.tsx`
- Modify: `app/(admin)/layout.tsx` (one `NavLink`, one icon import)

**Interfaces:**
- Consumes: `getAdminPaymentsByStatus`, `getPaymentStatusCounts` (Task 7).
- Produces: the route `/admin/payments`, with `?tab=pending|approved|rejected`.

- [x] **Step 1: Write the queue page**

Create `app/(admin)/admin/payments/page.tsx`:

```tsx
import { type EnrollmentStatus } from "@prisma/client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Inbox, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/admin/page-header";
import {
  getAdminPaymentsByStatus,
  getPaymentStatusCounts,
} from "@/lib/payments/queries";

type Props = { searchParams: Promise<{ tab?: string }> };

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const metadata = { title: "Payments — AQA Admin" };

export default async function AdminPaymentsPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const STATUS_MAP: Record<string, EnrollmentStatus> = {
    pending: "PENDING",
    approved: "APPROVED",
    rejected: "REJECTED",
  };
  const status: EnrollmentStatus = STATUS_MAP[tab ?? ""] ?? "PENDING";

  const [rows, countMap] = await Promise.all([
    getAdminPaymentsByStatus(status),
    getPaymentStatusCounts(),
  ]);

  const tabs = [
    {
      label: "Pending",
      value: "pending",
      enumStatus: "PENDING" as EnrollmentStatus,
    },
    {
      label: "Approved",
      value: "approved",
      enumStatus: "APPROVED" as EnrollmentStatus,
    },
    {
      label: "Rejected",
      value: "rejected",
      enumStatus: "REJECTED" as EnrollmentStatus,
    },
  ];

  const getStatusBadge = (s: EnrollmentStatus) => {
    if (s === "APPROVED")
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          Approved
        </Badge>
      );
    if (s === "REJECTED") return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="outline">Pending</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Payments" />

      <div className="flex gap-1 border-b -mt-2">
        {tabs.map((t) => {
          const isActive = t.enumStatus === status;
          const count = countMap[t.enumStatus] ?? 0;
          return (
            <Link
              key={t.value}
              href={`?tab=${t.value}`}
              className={cn(
                "flex items-center gap-1.5 px-4 pb-3 text-sm transition-colors",
                isActive
                  ? "border-b-2 border-primary text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span className="inline-block bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-xs font-medium">
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Inbox className="w-8 h-8" aria-hidden="true" />
          <p className="text-sm">No {status.toLowerCase()} payments.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th
                  scope="col"
                  className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                >
                  Student
                </th>
                <th
                  scope="col"
                  className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                >
                  Course
                </th>
                <th
                  scope="col"
                  className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                >
                  Amount
                </th>
                <th
                  scope="col"
                  className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                >
                  Submitted
                </th>
                <th
                  scope="col"
                  className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                >
                  Status
                </th>
                <th scope="col" aria-label="Actions" className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-2">
                    <p className="font-medium">{r.studentName}</p>
                    <p className="text-muted-foreground text-xs">
                      {r.studentEmail}
                    </p>
                  </td>
                  <td className="px-4 py-2">{r.courseTitle}</td>
                  <td className="px-4 py-2">
                    ₱{r.amount.toLocaleString("en-PH")}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {dateFormatter.format(r.createdAt)}
                  </td>
                  <td className="px-4 py-2">{getStatusBadge(r.status)}</td>
                  <td className="px-4 py-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={"/admin/payments/" + r.id}>
                        View{" "}
                        <ChevronRight
                          className="w-3 h-3 ml-1"
                          aria-hidden="true"
                        />
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
  );
}
```

- [x] **Step 2: Add the sidebar link**

In `app/(admin)/layout.tsx`, add `Wallet` to the existing `lucide-react` import list.

Then, directly after the `NavLink` whose `href` is `/admin/purchases` (label "Enrollment Requests"), add:

```tsx
          <NavLink
            href="/admin/payments"
            icon={<Wallet className="w-4 h-4" aria-hidden="true" />}
            label="Payments"
          />
```

- [x] **Step 3: Verify**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no output.

Run: `pnpm lint`
Expected: no errors.

- [x] **Step 4: Commit**

```bash
./node_modules/.bin/prettier --write "app/(admin)/admin/payments/page.tsx" "app/(admin)/layout.tsx"
git add "app/(admin)/admin/payments/page.tsx" "app/(admin)/layout.tsx"
git commit -m "feat: add admin payments queue"
```

---

### Task 14: The admin payment detail page

**Files:**
- Create: `app/(admin)/admin/payments/[id]/page.tsx`
- Create: `app/(admin)/admin/payments/[id]/approve-form.tsx`
- Create: `app/(admin)/admin/payments/[id]/reject-form.tsx`

**Interfaces:**
- Consumes: `getAdminPaymentById` (Task 7), `approvePaymentAction` / `rejectPaymentAction` (Task 12), `ProofImage` (Task 3).
- Produces: the route `/admin/payments/[id]`.

- [x] **Step 1: Write the approve form**

The resulting enrollment status is a required radio choice, defaulted to the enrollment's current value.
Create `app/(admin)/admin/payments/[id]/approve-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { approvePaymentAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function ApproveForm({
  id,
  currentStatus,
}: {
  id: string;
  currentStatus: "PARTIALLY_PAID" | "FULLY_PAID";
}) {
  const [state, action, isPending] = useActionState(approvePaymentAction, {
    error: null,
  });

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div>
        <p className="text-sm font-semibold">Resulting payment status</p>
        <p className="text-muted-foreground text-sm">
          Approving records this payment. Choose where the enrollment stands
          afterwards.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2 rounded-md border p-3">
          <input
            type="radio"
            name="paymentStatus"
            value="PARTIALLY_PAID"
            defaultChecked={currentStatus === "PARTIALLY_PAID"}
          />
          <span>Partially paid</span>
        </Label>
        <Label className="flex items-center gap-2 rounded-md border p-3">
          <input
            type="radio"
            name="paymentStatus"
            value="FULLY_PAID"
            defaultChecked={currentStatus === "FULLY_PAID"}
          />
          <span>Fully paid</span>
        </Label>
      </div>

      {state.error && <p className="text-destructive text-sm">{state.error}</p>}

      <Button
        type="submit"
        disabled={isPending}
        className="bg-green-600 hover:bg-green-700"
      >
        {isPending ? "Approving…" : "Approve payment"}
      </Button>
    </form>
  );
}
```

- [x] **Step 2: Write the reject form**

Create `app/(admin)/admin/payments/[id]/reject-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { rejectPaymentAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function RejectForm({ id }: { id: string }) {
  const [state, action, isPending] = useActionState(rejectPaymentAction, {
    error: null,
  });

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Label htmlFor="reason">Rejection reason</Label>
      <Textarea
        id="reason"
        name="reason"
        required
        rows={3}
        placeholder="Explain why this payment is rejected"
      />
      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
      <Button type="submit" variant="destructive" disabled={isPending}>
        {isPending ? "Rejecting…" : "Reject payment"}
      </Button>
    </form>
  );
}
```

- [x] **Step 3: Write the detail page**

Create `app/(admin)/admin/payments/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";
import { ProofImage } from "@/components/admin/proof-image";
import { getAdminPaymentById } from "@/lib/payments/queries";
import { ApproveForm } from "./approve-form";
import { RejectForm } from "./reject-form";

type Props = { params: Promise<{ id: string }> };

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function PaymentDetailPage({ params }: Props) {
  const { id } = await params;
  const payment = await getAdminPaymentById(id);
  if (!payment) notFound();

  const isPending = payment.status === "PENDING";

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <PageHeader title="Payment Detail" />

      <div className="rounded-xl border bg-card p-4 space-y-1">
        <div className="flex items-center justify-between">
          <p className="font-semibold">
            {payment.student.firstName} {payment.student.lastName}
          </p>
          {payment.status === "APPROVED" ? (
            <Badge className="bg-green-100 text-green-800 border-green-200">
              Approved
            </Badge>
          ) : payment.status === "REJECTED" ? (
            <Badge variant="destructive">Rejected</Badge>
          ) : (
            <Badge variant="outline">Pending</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{payment.student.email}</p>
        {payment.student.contactNumber && (
          <p className="text-sm text-muted-foreground">
            {payment.student.contactNumber}
          </p>
        )}
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Course</span>
          <span className="font-medium">{payment.courseTitle}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Submitted</span>
          <span className="font-medium">
            {dateFormatter.format(payment.createdAt)}
          </span>
        </div>
        <div className="flex items-center justify-between border-t pt-2 text-sm">
          <span className="text-muted-foreground">Amount</span>
          <span className="text-lg font-bold">
            ₱{payment.amount.toLocaleString("en-PH")}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Current enrollment status
          </span>
          <span className="font-medium">
            {payment.enrollmentPaymentStatus === "FULLY_PAID"
              ? "Fully paid"
              : "Partially paid"}
          </span>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Proof of payment
        </p>
        <ProofImage src={`/api/admin/payments/${payment.id}/proof`} />
      </div>

      {payment.status === "REJECTED" && payment.adminRemarks && (
        <p className="text-sm text-destructive">
          <strong>Rejection reason:</strong> {payment.adminRemarks}
        </p>
      )}

      {isPending && (
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
          <ApproveForm
            id={payment.id}
            currentStatus={payment.enrollmentPaymentStatus}
          />
          <div className="border-t pt-4">
            <RejectForm id={payment.id} />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [x] **Step 4: Verify**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no output.

Run: `pnpm lint`
Expected: no errors.

Run: `./node_modules/.bin/vitest run`
Expected: all tests pass.

- [x] **Step 5: Commit**

```bash
./node_modules/.bin/prettier --write "app/(admin)/admin/payments/[id]"/*.tsx
git add "app/(admin)/admin/payments/[id]"
git commit -m "feat: add admin payment detail and review page"
```

---

### Task 15: Manual end-to-end verification

There is no E2E harness in this repo (Playwright is a dependency, but there is no config or spec directory), so the real flow is verified by driving the running app.
This task changes no code unless it finds a defect.

**Files:**
- No files, unless a defect is found. Fix defects in the file that owns them and commit separately.

**Interfaces:**
- Consumes: everything built above.
- Produces: nothing.

- [x] **Step 1: Start the app**

Run: `pnpm dev`
Expected: server on `http://localhost:3000`.

- [x] **Step 2: Walk the student path**

As a student with a `PARTIALLY_PAID` enrollment:

1. Open `/student/dashboard`. The Payment section shows the course with an **Add payment** button.
2. Click it. `/student/payments/<enrollmentId>` shows the course title, the BPI and GCash block, an amount field, and a file input.
3. Submit with an amount of `0`. The form reports "Amount must be greater than 0."
4. Submit with a valid amount and a PDF. The form reports "Only JPG, PNG, and WEBP images are accepted."
5. Submit with a valid amount and a JPG. You land on `/student/dashboard?payment=1` with the green success banner.
6. The Payment section now reads "Payment under review" with no button.
7. Navigate directly to `/student/payments/<enrollmentId>` again. You are redirected to the dashboard.

- [x] **Step 3: Walk the admin path**

As an admin:

1. The sidebar shows **Payments** below Enrollment Requests.
2. `/admin/payments` lists the submission under Pending, with the correct student, course, amount, and date. The tab counts are right.
3. Open the detail page. The proof image loads.
4. Click **Reject** with an empty reason. The browser blocks submission (the textarea is `required`).
5. Enter a reason and reject. You return to the queue and the row is under Rejected.
6. Back on the student dashboard, the row shows the rejection reason and the **Add payment** button is back.
7. Submit a second payment, then approve it with **Fully paid**.
8. The student's dashboard course card badge flips to **Paid**, and the enrollment leaves the Payment section.

- [x] **Step 4: Check the console**

Confirm the dev server log has no unexpected errors, and the browser console is clean on every page you visited.

- [x] **Step 5: Final check of the whole tree**

Run: `./node_modules/.bin/vitest run`
Expected: all tests pass.

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no output.

Run: `pnpm lint`
Expected: no errors.

Run: `pnpm build`
Expected: build succeeds.
