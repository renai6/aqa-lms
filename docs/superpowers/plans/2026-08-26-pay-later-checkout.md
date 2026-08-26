# Pay Later at Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a student check "Pay later" at checkout, submit a purchase with no proof and no amount, and be enrolled with the full course total as their balance once an admin approves it.

**Architecture:** `Purchase.paymentProofUrl` becomes nullable, and "pay later" is derived from that null rather than stored as its own column.
Checkout hides the amount and proof inputs when the box is checked, and `createPurchaseAction` skips the upload entirely.
The admin approval transaction is behaviourally unchanged, because its existing "applied amounts must sum to amountPaid" check reconciles as `0 = 0` and its existing zero-amount skip means no ledger rows are written.

**Tech Stack:** Next.js 16 App Router (server components + server actions), Prisma 7 on Postgres, Zod 4, Tailwind, shadcn-style UI primitives, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-26-pay-later-checkout-design.md`

## Global Constraints

- Package manager is **pnpm**. Never `npm` or `yarn`.
- Never use an em dash in code, comments, copy, or commit messages. Use a plain dash.
- Money is compared and summed in **integer centavos** (`Math.round(x * 100)`), never in floats. This rule already governs `allocate`, `approvePurchaseAction`, and `ApproveForm`, and any new comparison must follow it.
- Comments explain **why**, not what. Match the density and voice of the surrounding files, which are comment-heavy at decision points and bare elsewhere.
- Currency is rendered with `peso()` from `@/lib/payments/balance` in admin UI, and with `₱${n.toLocaleString("en-PH")}` in the existing student checkout and admin list table. Follow whichever the file already uses.
- Tests mock `@/lib/db`; there is no test database. A mocked test cannot prove a column exists.
- **Migrations cannot be run from an agent session.** `prisma migrate dev` is blocked by the sandbox classifier and has no TTY. Task 1 stops and asks the user to run it in their own terminal.
- Commit after each task. Never add an agent name as co-author.

---

## File Structure

**Modified:**

- `prisma/schema.prisma` - `Purchase.paymentProofUrl` becomes nullable.
- `lib/purchases/payment.ts` - gains `isPayLater`, the one place the derivation is named.
- `lib/purchases/schema.ts` - `createPurchaseSchema` gains `payLater` and conditional amount rules.
- `lib/purchases/actions.ts` - `createPurchaseAction` branches around the upload.
- `lib/purchases/email.ts` - `sendPurchaseConfirmationEmail` gains a pay-later sentence.
- `lib/purchases/queries.ts` - `AdminPurchaseRow` and `AdminPurchaseDetail` expose `payLater`; detail's `paymentProofUrl` becomes nullable.
- `components/payment-instructions.tsx` - takes a `payLater` prop that swaps one sentence.
- `app/(student)/student/checkout/page.tsx` - neutral heading copy.
- `app/(student)/student/checkout/checkout-form.tsx` - the checkbox and the conditional inputs.
- `app/(admin)/admin/purchases/page.tsx` - "Pay later" badge in the Amount column.
- `app/(admin)/admin/purchases/[id]/page.tsx` - "Pay later" badge and the no-proof card.
- `app/(admin)/admin/purchases/[id]/approve-form.tsx` - hides the applied inputs at zero.
- `app/(admin)/admin/purchases/[id]/actions.ts` - null guard before the ledger write.

**Created:**

- `prisma/migrations/<timestamp>_purchase_proof_nullable/migration.sql` - generated, not hand-written.
- `lib/__tests__/purchases/create-pay-later.test.ts`
- `lib/__tests__/purchases/approve-pay-later.test.ts`

**Test files extended:** `lib/__tests__/purchases/payment.test.ts`, `lib/__tests__/purchases/schema.test.ts`.

---

### Task 1: Nullable proof column and the `isPayLater` derivation

**Files:**
- Modify: `prisma/schema.prisma` (the `Purchase` model, `paymentProofUrl` field)
- Modify: `lib/purchases/payment.ts`
- Modify: `app/(admin)/admin/purchases/[id]/actions.ts:199`
- Modify: `lib/purchases/queries.ts:131`
- Test: `lib/__tests__/purchases/payment.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `isPayLater(p: { paymentProofUrl: string | null }): boolean` from `@/lib/purchases/payment`. Tasks 5 and 6 use it. `Purchase.paymentProofUrl` is `string | null` for every later task.

- [ ] **Step 1: Write the failing test**

Append to `lib/__tests__/purchases/payment.test.ts`. Add `isPayLater` to the existing import at the top of that file.

```ts
describe("isPayLater", () => {
  it("is true when no proof was submitted", () => {
    expect(isPayLater({ paymentProofUrl: null })).toBe(true);
  });

  it("is false when a proof was submitted", () => {
    expect(isPayLater({ paymentProofUrl: "proof/p1/proof.jpg" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run lib/__tests__/purchases/payment.test.ts`
Expected: FAIL. The import of `isPayLater` does not resolve, so the file fails to load.

- [ ] **Step 3: Add the helper**

Append to `lib/purchases/payment.ts`:

```ts
// A purchase with no proof image is one the student asked to pay for later.
// Derived rather than stored: validation forbids a zero amount on a pay-now
// purchase, so a stored flag could only ever repeat what this column already
// says, and could drift from it.
export function isPayLater(p: { paymentProofUrl: string | null }): boolean {
  return p.paymentProofUrl === null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run lib/__tests__/purchases/payment.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Make the column nullable**

In `prisma/schema.prisma`, inside `model Purchase`, change:

```prisma
  paymentProofUrl String
```

to:

```prisma
  // Null means the student chose to pay later, so no proof exists to upload.
  paymentProofUrl String?
```

- [ ] **Step 6: Ask the user to run the migration**

You cannot run this yourself. Stop and tell the user, verbatim:

> The schema change needs a migration, which I cannot run from here. Please run this in your own terminal and tell me when it is done:
>
> `pnpm prisma migrate dev --name purchase_proof_nullable`

Wait for confirmation. Do not proceed on an assumption that it ran.

- [ ] **Step 7: Regenerate the Prisma client**

Run: `pnpm prisma generate`
Expected: "Generated Prisma Client".

Then confirm the migration folder actually exists, because `migrate deploy` and a blocked substep can both report success without creating one:

Run: `ls prisma/migrations | tail -3`
Expected: a folder ending in `_purchase_proof_nullable`.

- [ ] **Step 8: Fix the two places the widened type now breaks**

`lib/purchases/queries.ts:131`, in the `AdminPurchaseDetail` type, change `paymentProofUrl: string;` to:

```ts
  paymentProofUrl: string | null;
```

`app/(admin)/admin/purchases/[id]/actions.ts`, inside the `if (Math.round(entry.applied * 100) > 0) {` block, insert this guard immediately before the `await tx.payment.create({` call:

```ts
          // Applied money means money arrived at checkout, which means a proof
          // was uploaded: a pay-later purchase has amountPaid 0, and the
          // reconcile check above forces every applied amount to 0. An empty
          // string here would enter the ledger as a payment with no evidence,
          // so an impossible state fails loudly instead.
          if (purchase.paymentProofUrl === null) throw new Error("MISSING_PROOF");
```

In the same function's `catch` block, immediately after the `if (msg === "ALREADY_PROCESSED")` line and its return, add:

```ts
    if (msg === "MISSING_PROOF")
      return {
        error:
          "This purchase records money received but has no proof of payment. Contact the student before approving.",
      };
```

- [ ] **Step 9: Typecheck and run the full suite**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no errors.

Run: `pnpm vitest run`
Expected: all tests pass. The existing purchase tests pass a `paymentProofUrl` string, which is still valid.

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/purchases/payment.ts lib/purchases/queries.ts "app/(admin)/admin/purchases/[id]/actions.ts" lib/__tests__/purchases/payment.test.ts
git commit -m "feat: allow a purchase to carry no payment proof"
```

---

### Task 2: Checkout validation for pay later

**Files:**
- Modify: `lib/purchases/schema.ts`
- Modify: `lib/purchases/actions.ts` (one line, so the caller keeps compiling)
- Test: `lib/__tests__/purchases/schema.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `createPurchaseSchema` now expects a `payLater: boolean` field, and `CreatePurchaseInput` gains `payLater: boolean`. This task also supplies that field from FormData in `createPurchaseAction`, so the tree stays green; Task 3 is what actually uses it.

- [ ] **Step 1: Write the failing tests**

Append to `lib/__tests__/purchases/schema.test.ts`. Note the existing file already imports `createPurchaseSchema`.

```ts
const validPurchase = {
  courseIds: ["c1"],
  paymentType: "PARTIAL",
  amountPaid: "5000",
  payLater: false,
  studentType: "OLD",
};

describe("createPurchaseSchema pay-later rules", () => {
  it("accepts a pay-now purchase with a positive amount", () => {
    expect(createPurchaseSchema.safeParse(validPurchase).success).toBe(true);
  });

  it("rejects a pay-now purchase with no amount", () => {
    // FormData yields null for a missing field, which coerces to 0.
    const r = createPurchaseSchema.safeParse({
      ...validPurchase,
      amountPaid: null,
    });
    expect(r.success).toBe(false);
  });

  it("accepts a pay-later purchase with no amount", () => {
    const r = createPurchaseSchema.safeParse({
      ...validPurchase,
      payLater: true,
      amountPaid: null,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.amountPaid).toBe(0);
  });

  it("rejects a pay-later purchase that also carries an amount", () => {
    const r = createPurchaseSchema.safeParse({
      ...validPurchase,
      payLater: true,
      amountPaid: "5000",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a negative amount", () => {
    const r = createPurchaseSchema.safeParse({
      ...validPurchase,
      amountPaid: "-1",
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run lib/__tests__/purchases/schema.test.ts`
Expected: FAIL. "accepts a pay-later purchase with no amount" fails because `amountPaid` is still unconditionally `.positive()`.

- [ ] **Step 3: Rewrite the schema**

In `lib/purchases/schema.ts`, replace the whole `createPurchaseSchema` declaration with:

```ts
export const createPurchaseSchema = z
  .object({
    courseIds: z.array(z.string().min(1)).min(1, "Select at least one course."),
    paymentType: z.enum(["PARTIAL", "FULL"], {
      error: "Payment type is required.",
    }),
    // Zero is legal at this level so a pay-later purchase can omit the field
    // entirely. The refinement below is what makes zero illegal when the
    // student is paying now.
    amountPaid: z.coerce
      .number()
      .nonnegative("Amount paid cannot be negative.")
      .multipleOf(0.01, "Amount paid must be a whole number of centavos."),
    payLater: z.boolean(),
    studentType: z.enum(["NEW", "OLD"]),
  })
  .superRefine((d, ctx) => {
    if (d.payLater && d.amountPaid !== 0) {
      ctx.addIssue({
        code: "custom",
        path: ["amountPaid"],
        message: "A pay-later purchase cannot include an amount.",
      });
    }
    if (!d.payLater && d.amountPaid <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["amountPaid"],
        message: "Amount paid must be greater than 0.",
      });
    }
  });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run lib/__tests__/purchases/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Keep the caller typechecking**

The schema now requires `payLater`, so `createPurchaseAction` stops compiling until it supplies one.
Add exactly one line to the `raw` object in `lib/purchases/actions.ts`, between `amountPaid` and `studentType`:

```ts
    // An unchecked checkbox is absent from FormData, and a checked one is "on".
    // Converted here rather than coerced in the schema, because Boolean("false")
    // is true and coercion would quietly accept a wrong value.
    payLater: formData.get('payLater') === 'on',
```

Do not destructure `payLater` out of `result.data` yet. Nothing uses it until Task 3, and an unused binding fails lint.

- [ ] **Step 6: Verify the tree is green**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no errors.

Run: `pnpm lint`
Expected: no errors.

Run: `pnpm vitest run`
Expected: all tests pass. Paying now still works, because an absent `payLater` field reads as `false`.

- [ ] **Step 7: Commit**

```bash
git add lib/purchases/schema.ts lib/purchases/actions.ts lib/__tests__/purchases/schema.test.ts
git commit -m "feat: validate pay-later purchases at checkout"
```

---

### Task 3: Create a pay-later purchase without an upload

**Files:**
- Modify: `lib/purchases/actions.ts`
- Modify: `lib/purchases/email.ts`
- Test: `lib/__tests__/purchases/create-pay-later.test.ts` (create)

**Interfaces:**
- Consumes: `createPurchaseSchema` with `payLater` from Task 2; the nullable `paymentProofUrl` column from Task 1.
- Produces: `sendPurchaseConfirmationEmail(params: { to: string; firstName: string; purchaseId: string; payLater: boolean })`. The form in Task 4 must submit a checkbox named `payLater`.

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/purchases/create-pay-later.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    purchase: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { storage: { from: vi.fn() } },
}));
vi.mock("@/lib/uploads/image", () => ({ validateImageUpload: vi.fn() }));
vi.mock("@/lib/purchases/queries", () => ({ getPurchasableCourses: vi.fn() }));
vi.mock("@/lib/purchases/email", () => ({
  sendPurchaseConfirmationEmail: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateImageUpload } from "@/lib/uploads/image";
import { getPurchasableCourses } from "@/lib/purchases/queries";
import { sendPurchaseConfirmationEmail } from "@/lib/purchases/email";
import { createPurchaseAction } from "@/lib/purchases/actions";

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("createPurchaseAction pay later", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      userId: "u1",
      role: "STUDENT",
    } as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      email: "s@example.com",
      firstName: "Sam",
      studentType: "OLD",
      isActive: true,
    } as never);
    vi.mocked(getPurchasableCourses).mockResolvedValue([
      { id: "c1" },
    ] as never);
    vi.mocked(db.purchase.create).mockResolvedValue({ id: "p1" } as never);
  });

  it("records a zero amount and no proof, and never touches storage", async () => {
    await expect(
      createPurchaseAction(
        { error: null },
        form({ courseIds: "c1", paymentType: "PARTIAL", payLater: "on" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(db.purchase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountPaid: 0,
          paymentProofUrl: null,
        }),
      }),
    );
    expect(validateImageUpload).not.toHaveBeenCalled();
    expect(supabaseAdmin.storage.from).not.toHaveBeenCalled();
    expect(db.purchase.update).not.toHaveBeenCalled();
  });

  it("tells the confirmation email that no payment is due yet", async () => {
    await expect(
      createPurchaseAction(
        { error: null },
        form({ courseIds: "c1", paymentType: "PARTIAL", payLater: "on" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(sendPurchaseConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ payLater: true }),
    );
  });

  it("still requires a proof image when paying now", async () => {
    vi.mocked(validateImageUpload).mockResolvedValue({
      ok: false,
      error: "Please select a file to upload.",
    });

    const result = await createPurchaseAction(
      { error: null },
      form({ courseIds: "c1", paymentType: "PARTIAL", amountPaid: "5000" }),
    );

    expect(result.error).toBe("Please select a file to upload.");
    expect(db.purchase.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run lib/__tests__/purchases/create-pay-later.test.ts`
Expected: FAIL. Validation rejects the submission because `raw` has no `payLater` key, so `z.boolean()` sees `undefined`.

- [ ] **Step 3: Read `payLater` out of the parsed result**

Task 2 already added `payLater: formData.get('payLater') === 'on',` to the `raw` object in `lib/purchases/actions.ts`.
Confirm that line is present, then widen the destructure on the line below the `safeParse` guard:

```ts
  const { courseIds, paymentType, amountPaid, payLater } = result.data
```

- [ ] **Step 4: Branch around the upload**

Still in `lib/purchases/actions.ts`, replace these two lines:

```ts
  // Validate and upload the proof image.
  const image = await validateImageUpload(formData.get('file'))
  if (!image.ok) return { error: image.error }
```

with:

```ts
  // Paying later means there is nothing to validate and nothing to upload. The
  // purchase records the intent to enrol; the money arrives afterwards through
  // the normal payment flow, once an admin has approved it.
  const image = payLater ? null : await validateImageUpload(formData.get('file'))
  if (image && !image.ok) return { error: image.error }
```

- [ ] **Step 5: Store a null proof and make the upload conditional**

In the same file, in the `db.purchase.create` call, change:

```ts
        paymentProofUrl: '', // set after upload
```

to:

```ts
        paymentProofUrl: null, // set below after upload; stays null for pay later
```

Then replace the whole block that runs from `const storagePath = ...` down to the closing brace of the `try` that updates the proof URL, with this wrapped version:

```ts
  if (image?.ok) {
    const storagePath = `proof/${purchaseId}/proof.${image.ext}`
    const { error: uploadError } = await supabaseAdmin.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET!)
      .upload(storagePath, image.buffer, { contentType: image.contentType, upsert: true })
    if (uploadError) {
      console.error('[createPurchase] Supabase error:', uploadError)
      await db.purchase.delete({ where: { id: purchaseId } }).catch(() => {})
      return { error: 'Failed to upload payment proof. Please try again.' }
    }

    try {
      await db.purchase.update({ where: { id: purchaseId }, data: { paymentProofUrl: storagePath } })
    } catch (err) {
      console.error('[createPurchase] DB error (proof url):', err)
      return { error: 'Payment uploaded but could not be saved. Please contact support.' }
    }
  }
```

- [ ] **Step 6: Pass the flag to the confirmation email**

In the same file, change the email call to:

```ts
    await sendPurchaseConfirmationEmail({ to: user.email, firstName: user.firstName, purchaseId, payLater })
```

In `lib/purchases/email.ts`, replace `sendPurchaseConfirmationEmail` with:

```ts
export async function sendPurchaseConfirmationEmail(params: {
  to: string;
  firstName: string;
  purchaseId: string;
  payLater: boolean;
}): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/student/dashboard`;
  const received = params.payLater
    ? "We have received your enrollment request. You chose to pay later, so nothing is due yet - our team will review your request shortly."
    : "We have received your course purchase and proof of payment. Our team will review it shortly.";
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.to,
    subject: "We received your course purchase - Al-Qur'an Academy",
    html: `<p>Assalamualaykum ${escapeHtml(params.firstName)},</p>
<p>${received}</p>
<p>You can track its status here: <a href="${url}">${url}</a></p>
<p>Best regards,<br>Al-Qur'an Academy Team</p>`,
  });
  if (error)
    throw new Error(
      `Failed to send purchase confirmation email: ${error.message}`,
    );
}
```

Note the subject line loses its em dash, per the global constraint.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm vitest run lib/__tests__/purchases/create-pay-later.test.ts`
Expected: PASS, 3 tests.

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add lib/purchases/actions.ts lib/purchases/email.ts lib/__tests__/purchases/create-pay-later.test.ts
git commit -m "feat: create a pay-later purchase without a proof upload"
```

---

### Task 4: The checkout checkbox

**Files:**
- Modify: `app/(student)/student/checkout/checkout-form.tsx`
- Modify: `components/payment-instructions.tsx`
- Modify: `app/(student)/student/checkout/page.tsx`

**Interfaces:**
- Consumes: the `payLater` form field read in Task 3.
- Produces: `PaymentInstructions({ payLater }: { payLater?: boolean })`. The existing call in `app/(student)/student/payments/[enrollmentId]/payment-form.tsx` passes nothing and must keep working, so the prop defaults to `false`.

There is no test step here. This is presentational, the repo has no component tests for checkout, and Task 7's manual pass is what verifies it.

- [ ] **Step 1: Give `PaymentInstructions` the prop**

In `components/payment-instructions.tsx`, change the signature and the sub-heading paragraph:

```tsx
export function PaymentInstructions({
  payLater = false,
}: {
  payLater?: boolean;
}) {
```

```tsx
        <p className="text-muted-foreground mt-1 text-xs">
          {payLater
            ? "Once an admin approves your enrollment, pay via bank transfer or GCash and submit your proof from your course balance page."
            : "Pay via bank transfer or GCash, then upload your proof of payment below."}
        </p>
```

Also update the file's top comment, which currently claims one fixed use:

```tsx
// The BPI and GCash account details shown wherever a student is asked to pay
// offline: checkout, and the additional-payment page. One copy, so the account
// numbers cannot drift apart. `payLater` only changes when the student is told
// to pay, never the details themselves.
```

- [ ] **Step 2: Add the checkbox state to the checkout form**

In `app/(student)/student/checkout/checkout-form.tsx`, add `useState` to the React import:

```tsx
import { useActionState, useState } from "react";
```

and declare the state next to the existing `total`:

```tsx
  const [payLater, setPayLater] = useState(false);
```

- [ ] **Step 3: Render the checkbox and make the inputs conditional**

Replace everything from `<PaymentInstructions />` down to the closing `</div>` of the Proof of Payment block with:

```tsx
      <PaymentInstructions payLater={payLater} />

      <input type="hidden" name="paymentType" value="PARTIAL" />

      <label className="border-input hover:bg-muted/40 flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors">
        <input
          type="checkbox"
          name="payLater"
          checked={payLater}
          onChange={(e) => setPayLater(e.target.checked)}
          className="accent-primary mt-0.5 h-4 w-4 shrink-0"
        />
        <span>
          <span className="text-foreground block text-sm font-medium">
            Pay later
          </span>
          <span className="text-muted-foreground mt-1 block text-xs">
            Submit your enrollment now and pay after it is approved.
          </span>
        </span>
      </label>

      {payLater ? (
        <p className="text-muted-foreground bg-muted/40 rounded-xl border p-4 text-xs">
          An admin will review your request. Once it is approved you are
          enrolled, and the full ₱{total.toLocaleString("en-PH")} shows as your
          outstanding balance until you pay it.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="amountPaid">Amount Paying Now (₱)</Label>
            <Input
              id="amountPaid"
              name="amountPaid"
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
        </>
      )}
```

The inputs are unmounted rather than disabled, which is what removes their `required` attribute and lets the form submit.

- [ ] **Step 4: Reword the submit button**

Change the button label so it is honest in both modes:

```tsx
        {isPending
          ? "Submitting…"
          : payLater
            ? "Submit Enrollment Request"
            : "Submit Payment"}
```

- [ ] **Step 5: Neutralise the page heading copy**

In `app/(student)/student/checkout/page.tsx`, change the sub-heading, because the server component cannot know the checkbox state:

```tsx
        Review your selection, then choose how you want to pay.
```

- [ ] **Step 6: Verify it compiles and the payment page still builds**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no errors. In particular `payment-form.tsx` still calls `<PaymentInstructions />` with no props, which the default covers.

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add "app/(student)/student/checkout/checkout-form.tsx" "app/(student)/student/checkout/page.tsx" components/payment-instructions.tsx
git commit -m "feat: offer a pay-later option at checkout"
```

---

### Task 5: Make pay-later purchases obvious to the admin

**Files:**
- Modify: `lib/purchases/queries.ts`
- Modify: `app/(admin)/admin/purchases/page.tsx`
- Modify: `app/(admin)/admin/purchases/[id]/page.tsx`

**Interfaces:**
- Consumes: `isPayLater` from Task 1.
- Produces: `AdminPurchaseRow` gains `payLater: boolean`; `AdminPurchaseDetail` gains `payLater: boolean`. Task 6 does not use these, so this task and Task 6 are independent.

No test step. These are read-model projections and presentational changes with no branching logic worth a mocked test; Task 7's manual pass covers them.

- [ ] **Step 1: Expose `payLater` on the list row**

In `lib/purchases/queries.ts`, add the import:

```ts
import { isPayLater } from "@/lib/purchases/payment";
```

Add to the `AdminPurchaseRow` type:

```ts
  payLater: boolean;
```

In `getAdminPurchasesByStatus`, add `paymentProofUrl: true,` to the `select`, and add to the returned object literal:

```ts
    payLater: isPayLater(r),
```

- [ ] **Step 2: Expose `payLater` on the detail**

Add to the `AdminPurchaseDetail` type:

```ts
  payLater: boolean;
```

In `getAdminPurchaseById`'s return object, next to the existing `paymentProofUrl: r.paymentProofUrl,` line, add:

```ts
    payLater: isPayLater(r),
```

- [ ] **Step 3: Badge the queue row**

In `app/(admin)/admin/purchases/page.tsx`, replace the Amount cell:

```tsx
                  <td className="px-4 py-2">
                    ₱{r.amountPaid.toLocaleString("en-PH")}
                  </td>
```

with:

```tsx
                  <td className="px-4 py-2">
                    {r.payLater ? (
                      <Badge
                        variant="outline"
                        className="border-amber-200 bg-amber-50 text-amber-800"
                      >
                        Pay later
                      </Badge>
                    ) : (
                      `₱${r.amountPaid.toLocaleString("en-PH")}`
                    )}
                  </td>
```

The badge replaces the amount rather than sitting beside it, because a pay-later row's amount is always zero and printing "₱0" alongside it says the same thing twice.

- [ ] **Step 4: Badge the detail header**

In `app/(admin)/admin/purchases/[id]/page.tsx`, wrap the status badge so the two sit together. Replace the ternary chain inside the header `flex items-center justify-between` div with:

```tsx
          <div className="flex items-center gap-2">
            {purchase.payLater && (
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-50 text-amber-800"
              >
                Pay later
              </Badge>
            )}
            {purchase.status === "APPROVED" ? (
              <Badge className="border-green-200 bg-green-100 text-green-800">
                Approved
              </Badge>
            ) : purchase.status === "REJECTED" ? (
              <Badge variant="destructive">Rejected</Badge>
            ) : (
              <Badge variant="outline">Pending</Badge>
            )}
          </div>
```

- [ ] **Step 5: Replace the proof image with an explanation**

In the same file, replace:

```tsx
        <ProofImage src={`/api/admin/purchases/${purchase.id}/proof`} />
```

with:

```tsx
        {purchase.payLater ? (
          <p className="text-muted-foreground text-sm">
            No proof submitted - the student chose to pay later.
          </p>
        ) : (
          <ProofImage src={`/api/admin/purchases/${purchase.id}/proof`} />
        )}
```

- [ ] **Step 6: Verify**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no errors.

Run: `pnpm lint`
Expected: no errors. If `ProofImage` is now reported as unused, it is not: it is still used in the false branch.

Run: `pnpm vitest run`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/purchases/queries.ts "app/(admin)/admin/purchases/page.tsx" "app/(admin)/admin/purchases/[id]/page.tsx"
git commit -m "feat: flag pay-later purchases in the admin queue"
```

---

### Task 6: Approve a pay-later purchase

**Files:**
- Modify: `app/(admin)/admin/purchases/[id]/approve-form.tsx`
- Test: `lib/__tests__/purchases/approve-pay-later.test.ts` (create)

**Interfaces:**
- Consumes: `approvePurchaseAction` and its `totalDue_<courseId>` / `applied_<courseId>` form fields, unchanged from today.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/purchases/approve-pay-later.test.ts`:

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

let tx: {
  purchase: { updateMany: ReturnType<typeof vi.fn> };
  enrollment: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  payment: { create: ReturnType<typeof vi.fn> };
  batch: { findFirst: ReturnType<typeof vi.fn> };
};

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

// No proof and a zero amount: exactly what checkout writes for pay later.
const payLaterPurchase = {
  paymentType: "PARTIAL",
  amountPaid: { toNumber: () => 0 },
  paymentProofUrl: null,
  user: { id: "u1", email: "s@example.com", firstName: "Sam" },
  items: [{ courseId: "c1", course: { title: "Marhala 1", archivedAt: null } }],
};

describe("approvePurchaseAction on a pay-later purchase", () => {
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
    vi.mocked(db.$transaction).mockImplementation(((
      cb: (t: unknown) => unknown,
    ) => cb(tx)) as unknown as typeof db.$transaction);
    vi.mocked(db.purchase.findUnique).mockResolvedValue(
      payLaterPurchase as never,
    );
  });

  it("enrolls the student with the admin's total and no ledger rows", async () => {
    await expect(
      approvePurchaseAction(
        { error: null },
        form({ id: "p1", totalDue_c1: "10000", applied_c1: "0" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(tx.enrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          courseId: "c1",
          totalDue: 10000,
          paymentStatus: "PARTIALLY_PAID",
        }),
      }),
    );
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it("treats an omitted applied field as zero", async () => {
    await expect(
      approvePurchaseAction(
        { error: null },
        form({ id: "p1", totalDue_c1: "10000" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(tx.enrollment.create).toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it("refuses an applied amount the student never paid", async () => {
    const result = await approvePurchaseAction(
      { error: null },
      form({ id: "p1", totalDue_c1: "10000", applied_c1: "500" }),
    );

    expect(result.error).toContain("but the student paid");
    expect(tx.enrollment.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it passes already**

Run: `pnpm vitest run lib/__tests__/purchases/approve-pay-later.test.ts`
Expected: PASS, 3 tests, with no production change.

This is the point of the task. The approval path was designed to reconcile applied amounts against `amountPaid`, and at zero it already does the right thing. The test is here to lock that in so a later change cannot break pay-later approval silently. If any of the three fails, stop and investigate rather than editing the test to match.

- [ ] **Step 3: Commit the test on its own**

```bash
git add lib/__tests__/purchases/approve-pay-later.test.ts
git commit -m "test: lock in pay-later purchase approval"
```

- [ ] **Step 4: Hide the applied inputs when nothing was paid**

In `app/(admin)/admin/purchases/[id]/approve-form.tsx`, add this next to the existing `reconciles` calculation:

```tsx
  // A pay-later purchase brought no money, so every applied amount must be
  // zero for the reconcile check to pass. Showing inputs whose only valid
  // value is the one already in them invites an admin to type a number that
  // blocks their own approval.
  const nothingPaid = Math.round(amountPaid * 100) === 0;
```

- [ ] **Step 5: Reword the intro**

Replace the intro paragraph:

```tsx
        <p className="text-muted-foreground text-sm">
          Set what each course costs this student, and how much of the{" "}
          {peso(amountPaid)} received applies to each. Leave a total blank to
          skip balance tracking for that course.
        </p>
```

with:

```tsx
        <p className="text-muted-foreground text-sm">
          {nothingPaid
            ? "This student chose to pay later, so nothing has been received yet. Set what each course costs them, and the full amount will show as their balance. Leave a total blank to skip balance tracking for that course."
            : `Set what each course costs this student, and how much of the ${peso(amountPaid)} received applies to each. Leave a total blank to skip balance tracking for that course.`}
        </p>
```

- [ ] **Step 6: Make the applied field conditional**

Change the grid wrapper so it does not leave a half-width orphan, and drop the applied input:

```tsx
            <div
              className={
                nothingPaid ? "grid gap-3" : "grid gap-3 sm:grid-cols-2"
              }
            >
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
              {!nothingPaid && (
                <div>
                  <Label htmlFor={`applied_${course.id}`}>
                    Amount applied (₱)
                  </Label>
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
              )}
            </div>
```

An omitted `applied_<courseId>` field reaches the action as `null`, which it already reads as zero, so nothing needs to be submitted in its place.

- [ ] **Step 7: Reword the approve button for this case**

```tsx
        {isPending
          ? "Approving…"
          : nothingPaid
            ? "Approve and enroll"
            : "Approve purchase"}
```

- [ ] **Step 8: Verify**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: no errors.

Run: `pnpm lint`
Expected: no errors.

Run: `pnpm vitest run`
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add "app/(admin)/admin/purchases/[id]/approve-form.tsx"
git commit -m "feat: simplify approval when nothing was paid at checkout"
```

---

### Task 7: Full verification

**Files:** none modified unless a defect is found.

**Interfaces:**
- Consumes: everything.
- Produces: nothing.

- [ ] **Step 1: Run the whole automated suite**

```bash
./node_modules/.bin/tsc --noEmit
pnpm lint
pnpm vitest run
```

Expected: `tsc` clean, `pnpm lint` 0 errors (8 pre-existing warnings are the baseline), all tests passing.

Do **not** run `pnpm format:check` or `pnpm format` across the repo.
255 files fail that check on `main` already, so a repo-wide format would bury this feature in thousands of unrelated lines.
Check only the files this branch touched:

```bash
./node_modules/.bin/prettier --check $(git diff --name-only main...HEAD -- '*.ts' '*.tsx')
```

One known exception: `lib/purchases/actions.ts` was already unformatted before this branch and stays that way, so that its diff shows only the pay-later change.
Everything else this branch touched must pass.

Every failure gets fixed, including any that predates this branch, per the project's quality standard.

- [ ] **Step 2: Prove the column really exists**

Every test mocks `@/lib/db`, so nothing above proves the migration landed. Write a throwaway read-only script at the repo root (it must be inside the repo to resolve `node_modules`), run it, then delete it:

```ts
// scripts/check-proof-nullable.ts
import { db } from "@/lib/db";
const row = await db.purchase.findFirst({ select: { paymentProofUrl: true } });
console.log("ok, column readable:", row);
```

Run: `pnpm exec tsx scripts/check-proof-nullable.ts`
Expected: it prints without a Prisma error about an unknown or non-nullable column.

Then: `rm scripts/check-proof-nullable.ts`

- [ ] **Step 3: Manual end-to-end pass**

Run `pnpm dev` and walk the flow as a real user would, in this order:

1. As a student, add a course to the cart and reach `/student/checkout`.
2. Confirm the amount and file inputs are visible and required with the box unchecked.
3. Check "Pay later". Confirm both inputs disappear, the balance explanation appears with the correct total, the payment instructions sentence changes, and the button reads "Submit Enrollment Request".
4. Submit. Confirm the redirect to the dashboard succeeds with no upload error.
5. As an admin, open `/admin/purchases`. Confirm the row shows the "Pay later" badge in place of an amount.
6. Open the detail page. Confirm the "Pay later" badge sits beside "Pending", the proof card reads "No proof submitted", and no broken image renders.
7. Confirm the approve form shows only "Total due" per course, with the pay-later wording. Enter a total and approve.
8. As the student, confirm the course is now accessible and the balance view shows the full total outstanding.
9. Then re-run the ordinary path once: check out with a real amount and a proof image, and confirm approval still records the ledger row.

Be picky about spacing, alignment, and badge colour while doing this. Fix anything that looks off, including pre-existing issues on these screens.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: <what was actually wrong>"
```

If nothing needed fixing, skip this step rather than making an empty commit.

---

## Notes for the executor

- **Do not** add a `payLater` column. It was considered and rejected in the spec; the derivation in `isPayLater` is deliberate.
- **Do not** widen `Payment.proofUrl` to nullable. No `Payment` row is ever written for a pay-later purchase, and the Task 1 guard is what enforces that.
- **Do not** add due dates, reminders, or eligibility gating. All three were explicitly ruled out of scope.
- If a step's code does not match what is actually in the file, stop and report the difference rather than improvising. The plan was written against the tree at commit `ba13e39`.
