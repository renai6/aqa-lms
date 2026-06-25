# Purchase-Based Enrollment Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the pre-account `EnrollmentRequest` enrollment flow with a register-then-purchase flow: students self-register with their own password, browse courses, submit a cart-style purchase with one combined payment proof, and an admin approves/rejects the purchase to grant course access.

**Architecture:** A new `Purchase` + `PurchaseItem` pair models the order/cart and payment record. Profile fields move onto `User`. On admin approval, one `Enrollment` per purchase item is created — and because student access is still "does an `Enrollment` row exist?", the entire student-side access path is untouched. The old `EnrollmentRequest`, `PaymentProof`, and `Enrollment.totalPaid` are removed.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Prisma 7 + PostgreSQL, Zod 4, Tailwind CSS 4, shadcn/ui (radix-nova), Supabase Storage (payment proofs), Resend (email), Vitest (unit tests). Custom JWT-cookie auth (bcryptjs).

**Reference spec:** `docs/superpowers/specs/2026-06-25-purchase-based-enrollment-flow-design.md`

**Conventions to follow:**

- Import all Prisma enums/types from `@prisma/client` (never a custom output path).
- Server actions return `{ error: string | null; success?: boolean }` and `redirect()` on success.
- Tests in this repo are **pure-logic unit tests** (Vitest, `environment: node`, mocked deps) under `lib/__tests__/`. DB-touching actions/pages are verified via `pnpm lint` + `pnpm build` + manual smoke test, not integration tests. TDD therefore targets Zod schemas and pure helpers.
- Run a single test file with: `pnpm test --run <path>`.

---

## File Structure

**Create:**

- `lib/uploads/image.ts` — shared payment-proof image validation (type + size + magic bytes), extracted from the old `uploadProofAction`.
- `lib/purchases/payment.ts` — `paymentStatusFromType` helper.
- `lib/purchases/schema.ts` — Zod schemas: `registerSchema`, `createPurchaseSchema`.
- `lib/purchases/actions.ts` — `createPurchaseAction` (student).
- `lib/purchases/queries.ts` — student + admin purchase queries; available-courses query.
- `lib/purchases/email.ts` — purchase confirmation / approval / rejection emails (no credentials).
- `app/(auth)/register/page.tsx`, `app/(auth)/register/register-form.tsx`, `app/(auth)/register/actions.ts` — registration.
- `app/(student)/student/courses/page.tsx`, `.../courses/cart.tsx` — browse + cart.
- `app/(student)/student/checkout/page.tsx`, `.../checkout/checkout-form.tsx` — checkout/proof upload.
- `app/(student)/student/purchases/page.tsx` — purchase status list.
- `app/(admin)/admin/purchases/page.tsx` — admin purchase list.
- `app/(admin)/admin/purchases/[id]/page.tsx`, `.../[id]/approve-form.tsx`, `.../[id]/reject-form.tsx`, `.../[id]/actions.ts`, `.../[id]/proof-image.tsx` — admin detail + approve/reject.
- `app/api/admin/purchases/[id]/proof/route.ts` — signed-URL proof for admin.
- `lib/__tests__/uploads/image.test.ts`, `lib/__tests__/purchases/payment.test.ts`, `lib/__tests__/purchases/schema.test.ts`, `lib/__tests__/auth/middleware.test.ts` (extend).

**Modify:**

- `prisma/schema.prisma` — add models/fields, remove `EnrollmentRequest`/`PaymentProof`/`Enrollment.totalPaid`.
- `proxy.ts` — add `/register` to `AUTH_PATHS` + matcher.
- `app/(auth)/login/page.tsx` — link to `/register`.
- `components/student/nav.tsx` — add Courses + Purchases links.
- `lib/student/queries.ts` — dashboard: drop `totalPaid`/`paymentProofs`, read linked `Purchase`.
- `app/(admin)/admin/dashboard/page.tsx` — pending-purchases stat.
- Admin nav (sidebar) — "Enrollments" → "Purchases".

**Delete:**

- `app/(public)/courses/[id]/enroll/` (page + `enroll-form.tsx`).
- `app/(public)/enroll/` (whole subtree: `[requestId]/page.tsx`, `upload-proof-form.tsx`).
- `app/(admin)/admin/enrollments/` (whole subtree: list, `[id]/page.tsx`, `actions.ts`, `approve-form.tsx`, `reject-form.tsx`, `payment-section.tsx`, `update-payment-status-form.tsx`).
- `lib/enrollments/actions.ts`, `lib/enrollments/queries.ts`, `lib/enrollments/email.ts`, `lib/enrollments/password.ts`.
- `app/api/admin/enrollments/[id]/proof/route.ts`, `app/api/admin/payment-proof/[proofId]/route.ts`, `app/api/student/payment-proof/[proofId]/route.ts`.

---

## Phase 1 — Schema & migration

### Task 1: Update Prisma schema and migrate

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `Purchase` and `PurchaseItem` models**

Add after the `Enrollment`/`PaymentProof` section (before `Assessment`):

```prisma
model Purchase {
  id              String           @id @default(cuid())
  userId          String
  user            User             @relation(fields: [userId], references: [id])
  status          EnrollmentStatus @default(PENDING)
  paymentType     PaymentType      @default(FULL)
  amountPaid      Decimal          @default(0)
  paymentProofUrl String
  adminRemarks    String?
  reviewedById    String?
  reviewedBy      User?            @relation("ReviewedPurchases", fields: [reviewedById], references: [id])
  reviewedAt      DateTime?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  items           PurchaseItem[]
  enrollments     Enrollment[]

  @@index([userId])
}

model PurchaseItem {
  id         String   @id @default(cuid())
  purchaseId String
  purchase   Purchase @relation(fields: [purchaseId], references: [id], onDelete: Cascade)
  courseId   String
  course     Course   @relation(fields: [courseId], references: [id])

  @@unique([purchaseId, courseId])
  @@index([courseId])
}
```

- [ ] **Step 2: Add profile fields + purchase relations to `User`**

In `model User`, add the profile columns near `gender`:

```prisma
  gender             Gender?
  address            String?
  contactNumber      String?
  facebookName       String?
  facebookLink       String?
  studentType        StudentType?
  mustChangePassword Boolean  @default(false)
```

And in the relations block of `User`, **remove** `enrollmentRequests EnrollmentRequest[]` and **add**:

```prisma
  purchases         Purchase[]
  reviewedPurchases Purchase[] @relation("ReviewedPurchases")
```

- [ ] **Step 3: Update `Enrollment` — add `purchaseId`, remove `totalPaid` and `paymentProofs`**

Replace the payment portion of `model Enrollment` so it reads:

```prisma
  progress Float @default(0)

  paymentStatus PaymentStatus @default(PARTIALLY_PAID)

  purchaseId String?
  purchase   Purchase? @relation(fields: [purchaseId], references: [id])

  @@unique([userId, courseId])
```

(Delete the `totalPaid` line and the `paymentProofs PaymentProof[]` line.)

- [ ] **Step 4: Update `Course` relations**

In `model Course`, **remove** `requests EnrollmentRequest[]` and **add** `purchaseItems PurchaseItem[]`.

- [ ] **Step 5: Delete the `EnrollmentRequest` and `PaymentProof` models**

Delete the entire `model EnrollmentRequest { ... }` block and the entire `model PaymentProof { ... }` block.

- [ ] **Step 6: Create the migration and regenerate the client**

Run:

```bash
pnpm prisma migrate dev --name purchase_based_enrollment
pnpm prisma generate
```

Expected: migration applies cleanly; SQL drops `EnrollmentRequest` + `PaymentProof` tables and `Enrollment.totalPaid`, creates `Purchase` + `PurchaseItem`, adds the new `User`/`Enrollment` columns. (Dev data is disposable — confirm "yes" if prompted about data loss.)

- [ ] **Step 7: Verify the schema compiles into the type checker**

Run:

```bash
pnpm prisma validate
```

Expected: "The schema at prisma/schema.prisma is valid 🚀".

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add Purchase/PurchaseItem, move profile to User, drop EnrollmentRequest"
```

---

## Phase 2 — Shared helpers (TDD)

### Task 2: Extract image-upload validation helper

**Files:**

- Create: `lib/uploads/image.ts`
- Test: `lib/__tests__/uploads/image.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/__tests__/uploads/image.test.ts
import { describe, it, expect } from "vitest";
import { validateImageUpload } from "@/lib/uploads/image";

function fileFrom(bytes: number[], type: string, name = "proof") {
  return new File([new Uint8Array(bytes)], name, { type });
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0];
const JPEG = [0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

describe("validateImageUpload", () => {
  it("accepts a valid PNG and returns buffer + ext", async () => {
    const res = await validateImageUpload(fileFrom(PNG, "image/png"));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.ext).toBe("png");
  });

  it("accepts JPEG and WEBP", async () => {
    expect((await validateImageUpload(fileFrom(JPEG, "image/jpeg"))).ok).toBe(
      true,
    );
    expect((await validateImageUpload(fileFrom(WEBP, "image/webp"))).ok).toBe(
      true,
    );
  });

  it("rejects an empty file", async () => {
    const res = await validateImageUpload(fileFrom([], "image/png"));
    expect(res.ok).toBe(false);
  });

  it("rejects a disallowed mime type", async () => {
    const res = await validateImageUpload(fileFrom(PNG, "application/pdf"));
    expect(res.ok).toBe(false);
  });

  it("rejects content whose magic bytes do not match an image", async () => {
    const res = await validateImageUpload(
      fileFrom([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "image/png"),
    );
    expect(res.ok).toBe(false);
  });

  it("rejects files larger than 5MB", async () => {
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big", {
      type: "image/png",
    });
    const res = await validateImageUpload(big);
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test --run lib/__tests__/uploads/image.test.ts`
Expected: FAIL — cannot resolve `@/lib/uploads/image`.

- [ ] **Step 3: Implement the helper**

```typescript
// lib/uploads/image.ts
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_SIZE = 5 * 1024 * 1024;

export type ImageValidationResult =
  | { ok: true; buffer: Buffer; ext: string; contentType: string }
  | { ok: false; error: string };

export async function validateImageUpload(
  file: unknown,
): Promise<ImageValidationResult> {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Please select a file to upload." };
  }
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return { ok: false, error: "Only JPG, PNG, and WEBP images are accepted." };
  }
  if (file.size > MAX_SIZE) {
    return { ok: false, error: "File size must be 5MB or less." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const h = new Uint8Array(buffer.subarray(0, 12));
  const isJpeg = h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff;
  const isPng =
    h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47;
  const isWebp =
    h[0] === 0x52 &&
    h[1] === 0x49 &&
    h[2] === 0x46 &&
    h[3] === 0x46 &&
    h[8] === 0x57 &&
    h[9] === 0x45 &&
    h[10] === 0x42 &&
    h[11] === 0x50;
  if (!isJpeg && !isPng && !isWebp) {
    return {
      ok: false,
      error: "Invalid image file. Only JPG, PNG, and WEBP images are accepted.",
    };
  }

  return { ok: true, buffer, ext: EXT[file.type], contentType: file.type };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test --run lib/__tests__/uploads/image.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/uploads/image.ts lib/__tests__/uploads/image.test.ts
git commit -m "feat(uploads): add shared image-upload validation helper"
```

### Task 3: Payment-status helper

**Files:**

- Create: `lib/purchases/payment.ts`
- Test: `lib/__tests__/purchases/payment.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/__tests__/purchases/payment.test.ts
import { describe, it, expect } from "vitest";
import { paymentStatusFromType } from "@/lib/purchases/payment";

describe("paymentStatusFromType", () => {
  it("maps FULL to FULLY_PAID", () => {
    expect(paymentStatusFromType("FULL")).toBe("FULLY_PAID");
  });
  it("maps PARTIAL to PARTIALLY_PAID", () => {
    expect(paymentStatusFromType("PARTIAL")).toBe("PARTIALLY_PAID");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test --run lib/__tests__/purchases/payment.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement**

```typescript
// lib/purchases/payment.ts
import type { PaymentStatus, PaymentType } from "@prisma/client";

export function paymentStatusFromType(type: PaymentType): PaymentStatus {
  return type === "FULL" ? "FULLY_PAID" : "PARTIALLY_PAID";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test --run lib/__tests__/purchases/payment.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/purchases/payment.ts lib/__tests__/purchases/payment.test.ts
git commit -m "feat(purchases): add paymentStatusFromType helper"
```

### Task 4: Zod schemas (register + checkout) with tests

**Files:**

- Create: `lib/purchases/schema.ts`
- Test: `lib/__tests__/purchases/schema.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/__tests__/purchases/schema.test.ts
import { describe, it, expect } from "vitest";
import { registerSchema, createPurchaseSchema } from "@/lib/purchases/schema";

const validRegister = {
  firstName: "Juan",
  lastName: "dela Cruz",
  email: "juan@example.com",
  password: "Password123",
  confirmPassword: "Password123",
  gender: "MALE",
  address: "123 Main St",
  contactNumber: "09171234567",
  facebookName: "Juan dela Cruz",
  facebookLink: "https://facebook.com/juan",
  studentType: "NEW",
};

describe("registerSchema", () => {
  it("accepts valid input", () => {
    expect(registerSchema.safeParse(validRegister).success).toBe(true);
  });
  it("rejects mismatched passwords", () => {
    const r = registerSchema.safeParse({
      ...validRegister,
      confirmPassword: "nope",
    });
    expect(r.success).toBe(false);
  });
  it("rejects a short password", () => {
    const r = registerSchema.safeParse({
      ...validRegister,
      password: "a1",
      confirmPassword: "a1",
    });
    expect(r.success).toBe(false);
  });
  it("rejects an invalid PH mobile number", () => {
    const r = registerSchema.safeParse({
      ...validRegister,
      contactNumber: "12345",
    });
    expect(r.success).toBe(false);
  });
  it("rejects a non-https facebook link", () => {
    const r = registerSchema.safeParse({
      ...validRegister,
      facebookLink: "http://facebook.com/x",
    });
    expect(r.success).toBe(false);
  });
});

describe("createPurchaseSchema", () => {
  const base = {
    courseIds: ["c1", "c2"],
    paymentType: "FULL",
    amountPaid: 5000,
    studentType: "OLD",
  };
  it("accepts a valid OLD-student partial purchase", () => {
    const r = createPurchaseSchema.safeParse({
      ...base,
      paymentType: "PARTIAL",
      amountPaid: 1000,
    });
    expect(r.success).toBe(true);
  });
  it("requires at least one course", () => {
    const r = createPurchaseSchema.safeParse({ ...base, courseIds: [] });
    expect(r.success).toBe(false);
  });
  it("rejects amountPaid <= 0", () => {
    const r = createPurchaseSchema.safeParse({ ...base, amountPaid: 0 });
    expect(r.success).toBe(false);
  });
  it("forces NEW students to pay in full", () => {
    const r = createPurchaseSchema.safeParse({
      ...base,
      studentType: "NEW",
      paymentType: "PARTIAL",
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test --run lib/__tests__/purchases/schema.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement the schemas**

```typescript
// lib/purchases/schema.ts
import { z } from "zod";

const PH_MOBILE = /^(09\d{9}|\+639\d{9})$/;

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required."),
    lastName: z.string().trim().min(1, "Last name is required."),
    email: z.string().email("A valid email address is required."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .regex(/[A-Za-z]/, "Password must contain a letter.")
      .regex(/\d/, "Password must contain a number."),
    confirmPassword: z.string(),
    gender: z.enum(["MALE", "FEMALE"], { error: "Gender is required." }),
    address: z.string().trim().min(1, "Address is required."),
    contactNumber: z
      .string()
      .trim()
      .regex(PH_MOBILE, "Enter a valid PH mobile number (e.g. 09XXXXXXXXX)."),
    facebookName: z.string().trim().min(1, "Facebook name is required."),
    facebookLink: z
      .string()
      .url("Enter a valid URL.")
      .refine((u) => u.startsWith("https://"), "Link must use HTTPS."),
    studentType: z.enum(["NEW", "OLD"], { error: "Student type is required." }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const createPurchaseSchema = z
  .object({
    courseIds: z.array(z.string().min(1)).min(1, "Select at least one course."),
    paymentType: z.enum(["PARTIAL", "FULL"], {
      error: "Payment type is required.",
    }),
    amountPaid: z.coerce
      .number()
      .positive("Amount paid must be greater than 0."),
    studentType: z.enum(["NEW", "OLD"]),
  })
  .refine((d) => !(d.studentType === "NEW" && d.paymentType !== "FULL"), {
    message: "New students must pay in full.",
    path: ["paymentType"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test --run lib/__tests__/purchases/schema.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/purchases/schema.ts lib/__tests__/purchases/schema.test.ts
git commit -m "feat(purchases): add register + checkout Zod schemas"
```

---

## Phase 3 — Registration

### Task 5: `registerAction`

**Files:**

- Create: `app/(auth)/register/actions.ts`

- [ ] **Step 1: Implement the action**

```typescript
// app/(auth)/register/actions.ts
"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { registerSchema } from "@/lib/purchases/schema";

type ActionState = { error: string | null };

export async function registerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    gender: formData.get("gender"),
    address: formData.get("address"),
    contactNumber: formData.get("contactNumber"),
    facebookName: formData.get("facebookName"),
    facebookLink: formData.get("facebookLink"),
    studentType: formData.get("studentType"),
  };

  const result = registerSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Validation failed." };
  }
  const d = result.data;
  const email = d.email.trim().toLowerCase();

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) return { error: "An account with this email already exists." };

  let user: { id: string; role: "STUDENT"; email: string };
  try {
    const created = await db.user.create({
      data: {
        email,
        passwordHash: await hashPassword(d.password),
        firstName: d.firstName,
        lastName: d.lastName,
        role: "STUDENT",
        isActive: true,
        mustChangePassword: false,
        gender: d.gender,
        address: d.address,
        contactNumber: d.contactNumber,
        facebookName: d.facebookName,
        facebookLink: d.facebookLink,
        studentType: d.studentType,
      },
      select: { id: true, role: true, email: true },
    });
    user = created as typeof user;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2002") || msg.includes("Unique constraint")) {
      return { error: "An account with this email already exists." };
    }
    console.error("[register] DB error:", err);
    return { error: "A database error occurred. Please try again." };
  }

  await createSession({
    id: user.id,
    role: user.role,
    email: user.email,
    mustChangePassword: false,
  });
  redirect("/student/courses");
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `pnpm lint`
Expected: no errors for `app/(auth)/register/actions.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/\(auth\)/register/actions.ts
git commit -m "feat(auth): add student self-registration action"
```

### Task 6: Registration page + form

**Files:**

- Create: `app/(auth)/register/page.tsx`
- Create: `app/(auth)/register/register-form.tsx`

- [ ] **Step 1: Create the page**

```tsx
// app/(auth)/register/page.tsx
import { RegisterForm } from "./register-form";

export const metadata = { title: "Create an account — Al-Qur'an Academy" };

export default function RegisterPage() {
  return (
    <div className="w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-3 duration-500">
      <div className="mb-8">
        <h2 className="text-[1.75rem] font-bold text-foreground tracking-tight leading-none">
          Create your account
        </h2>
        <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
          Register to browse and purchase courses.
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
```

- [ ] **Step 2: Create the form**

Build the client form modeled on the existing enroll form's field set (`app/(public)/courses/[id]/enroll/enroll-form.tsx`), but for registration: name, email, password + confirm, gender (radio), address (Textarea), contact number, facebook name/link, student type (radio). Wire to `registerAction` via `useActionState`. Include a "Sign in" link to `/login`.

```tsx
// app/(auth)/register/register-form.tsx
"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { registerAction } from "./actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(registerAction, {
    error: null,
  });
  const [gender, setGender] = useState<"MALE" | "FEMALE">("MALE");
  const [studentType, setStudentType] = useState<"NEW" | "OLD">("NEW");

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input id="firstName" name="firstName" required placeholder="Juan" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            name="lastName"
            required
            placeholder="dela Cruz"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          placeholder="juan@example.com"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Gender</Label>
        <div className="flex gap-3">
          {(["MALE", "FEMALE"] as const).map((g) => (
            <label key={g} className="flex-1 cursor-pointer">
              <input
                type="radio"
                name="gender"
                value={g}
                checked={gender === g}
                onChange={() => setGender(g)}
                className="peer sr-only"
              />
              <div
                className={[
                  "rounded-xl border-2 p-3 text-center transition-colors",
                  gender === g
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card",
                ].join(" ")}
              >
                <p className="text-sm font-semibold text-foreground">
                  {g === "MALE" ? "Male" : "Female"}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          name="address"
          required
          rows={2}
          placeholder="House No., Street, Barangay, City, Province"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contactNumber">Contact Number</Label>
        <Input
          id="contactNumber"
          name="contactNumber"
          type="tel"
          required
          placeholder="09XXXXXXXXX"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="facebookName">Facebook Name</Label>
        <Input
          id="facebookName"
          name="facebookName"
          required
          placeholder="Juan dela Cruz"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="facebookLink">Facebook Link</Label>
        <Input
          id="facebookLink"
          name="facebookLink"
          type="url"
          required
          placeholder="https://facebook.com/yourprofile"
        />
      </div>

      <div className="space-y-2">
        <Label>Student Type</Label>
        <div className="flex gap-3">
          {(["NEW", "OLD"] as const).map((t) => (
            <label key={t} className="flex-1 cursor-pointer">
              <input
                type="radio"
                name="studentType"
                value={t}
                checked={studentType === t}
                onChange={() => setStudentType(t)}
                className="peer sr-only"
              />
              <div
                className={[
                  "rounded-xl border-2 p-3 text-center transition-colors",
                  studentType === t
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card",
                ].join(" ")}
              >
                <p className="text-sm font-semibold text-foreground">
                  {t === "NEW" ? "New Student" : "Old Student"}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {state.error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          {state.error}
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="w-full h-11 font-semibold"
      >
        {isPending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium"
          style={{ color: "oklch(0.525 0.223 3.958)" }}
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 3: Verify it type-checks**

Run: `pnpm lint`
Expected: no errors for the register page/form.

- [ ] **Step 4: Commit**

```bash
git add app/\(auth\)/register/page.tsx app/\(auth\)/register/register-form.tsx
git commit -m "feat(auth): add registration page and form"
```

### Task 7: Middleware — treat `/register` as an auth path

**Files:**

- Modify: `proxy.ts`
- Test: `lib/__tests__/auth/middleware.test.ts`

- [ ] **Step 1: Add a failing test**

Append to `lib/__tests__/auth/middleware.test.ts` inside the `describe('middleware', …)` block:

```typescript
it("redirects an authenticated user away from /register", async () => {
  vi.mocked(verifySessionToken).mockResolvedValue({
    sub: "u1",
    role: "STUDENT",
    email: "x@x.com",
    mustChangePassword: false,
  });
  const res = await proxy(makeRequest("/register", "some-token"));
  expect(res.status).toBe(307);
  expect(res.headers.get("location")).toContain("/student/dashboard");
});

it("allows an unauthenticated user to reach /register", async () => {
  vi.mocked(verifySessionToken).mockResolvedValue(null);
  const res = await proxy(makeRequest("/register"));
  expect(res.status).toBe(200);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test --run lib/__tests__/auth/middleware.test.ts`
Expected: FAIL — `/register` is not matched, so the second test gets a `next()` 200 but the first does not redirect (or `/register` is not in the matcher). Confirm at least the redirect test fails.

- [ ] **Step 3: Update `proxy.ts`**

Add `/register` to `AUTH_PATHS`:

```typescript
const AUTH_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];
```

And add `'/register'` to the `config.matcher` array.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test --run lib/__tests__/auth/middleware.test.ts`
Expected: PASS (all middleware tests).

- [ ] **Step 5: Commit**

```bash
git add proxy.ts lib/__tests__/auth/middleware.test.ts
git commit -m "feat(auth): route /register through auth middleware"
```

### Task 8: Link to registration from login

**Files:**

- Modify: `app/(auth)/login/page.tsx`

- [ ] **Step 1: Replace the bottom "course CTA" block**

Replace the existing `{/* Divider + course CTA (mobile) */}` block at the bottom of the login form with a register link visible on all viewports:

```tsx
<div className="mt-7 pt-6 border-t border-border/60 text-center">
  <p className="text-sm text-muted-foreground">
    New here?{" "}
    <Link
      href="/register"
      className="font-medium hover:opacity-80 transition-opacity"
      style={{ color: "oklch(0.525 0.223 3.958)" }}
    >
      Create an account
    </Link>
  </p>
</div>
```

(`Link` is already imported.)

- [ ] **Step 2: Verify**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(auth\)/login/page.tsx
git commit -m "feat(auth): link to registration from login"
```

---

## Phase 4 — Purchase flow (student)

### Task 9: Purchase queries

**Files:**

- Create: `lib/purchases/queries.ts`

- [ ] **Step 1: Implement queries**

```typescript
// lib/purchases/queries.ts
import { db } from "@/lib/db";
import type { EnrollmentStatus, PaymentType } from "@prisma/client";

export type PurchasableCourse = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  tuitionFee: number | null;
};

// Published courses the student is not already enrolled in and has no PENDING/APPROVED purchase for.
export async function getPurchasableCourses(
  userId: string,
): Promise<PurchasableCourse[]> {
  const [courses, enrollments, pendingItems] = await Promise.all([
    db.course.findMany({
      where: { isPublished: true },
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        tuitionFee: true,
      },
    }),
    db.enrollment.findMany({ where: { userId }, select: { courseId: true } }),
    db.purchaseItem.findMany({
      where: { purchase: { userId, status: { in: ["PENDING", "APPROVED"] } } },
      select: { courseId: true },
    }),
  ]);
  const taken = new Set([
    ...enrollments.map((e) => e.courseId),
    ...pendingItems.map((p) => p.courseId),
  ]);
  return courses
    .filter((c) => !taken.has(c.id))
    .map((c) => ({ ...c, tuitionFee: c.tuitionFee?.toNumber() ?? null }));
}

export type CheckoutCourse = {
  id: string;
  title: string;
  tuitionFee: number | null;
};

// Validates the selected course ids are purchasable; returns the resolved course rows.
export async function getCheckoutCourses(
  userId: string,
  courseIds: string[],
): Promise<CheckoutCourse[]> {
  const available = await getPurchasableCourses(userId);
  const byId = new Map(available.map((c) => [c.id, c]));
  const resolved: CheckoutCourse[] = [];
  for (const id of courseIds) {
    const c = byId.get(id);
    if (c)
      resolved.push({ id: c.id, title: c.title, tuitionFee: c.tuitionFee });
  }
  return resolved;
}

export type StudentPurchaseRow = {
  id: string;
  status: EnrollmentStatus;
  paymentType: PaymentType;
  amountPaid: number;
  adminRemarks: string | null;
  createdAt: Date;
  courses: string[];
};

export async function getStudentPurchases(
  userId: string,
): Promise<StudentPurchaseRow[]> {
  const rows = await db.purchase.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      paymentType: true,
      amountPaid: true,
      adminRemarks: true,
      createdAt: true,
      items: { select: { course: { select: { title: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    paymentType: r.paymentType,
    amountPaid: r.amountPaid.toNumber(),
    adminRemarks: r.adminRemarks,
    createdAt: r.createdAt,
    courses: r.items.map((i) => i.course.title),
  }));
}
```

- [ ] **Step 2: Verify**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/purchases/queries.ts
git commit -m "feat(purchases): add student purchase queries"
```

### Task 10: `createPurchaseAction`

**Files:**

- Create: `lib/purchases/actions.ts`

- [ ] **Step 1: Implement the action**

```typescript
// lib/purchases/actions.ts
"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateImageUpload } from "@/lib/uploads/image";
import { createPurchaseSchema } from "@/lib/purchases/schema";
import { getPurchasableCourses } from "@/lib/purchases/queries";
import { sendPurchaseConfirmationEmail } from "@/lib/purchases/email";

type ActionState = { error: string | null };

export async function createPurchaseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") return { error: "Unauthorized" };

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { email: true, firstName: true, studentType: true },
  });
  if (!user) return { error: "Account not found." };

  const raw = {
    courseIds: formData.getAll("courseIds").map(String),
    paymentType: formData.get("paymentType"),
    amountPaid: formData.get("amountPaid"),
    studentType: user.studentType ?? "OLD",
  };
  const result = createPurchaseSchema.safeParse(raw);
  if (!result.success)
    return { error: result.error.issues[0]?.message ?? "Validation failed." };
  const { courseIds, paymentType, amountPaid } = result.data;

  // Re-validate every selected course is still purchasable for this user.
  const purchasable = new Set(
    (await getPurchasableCourses(session.userId)).map((c) => c.id),
  );
  const invalid = courseIds.filter((id) => !purchasable.has(id));
  if (invalid.length > 0) {
    return {
      error:
        "One or more selected courses are no longer available for purchase.",
    };
  }

  // Validate and upload the proof image.
  const image = await validateImageUpload(formData.get("file"));
  if (!image.ok) return { error: image.error };

  let purchaseId: string;
  try {
    const purchase = await db.purchase.create({
      data: {
        userId: session.userId,
        paymentType,
        amountPaid,
        paymentProofUrl: "", // set after upload
        items: { create: courseIds.map((courseId) => ({ courseId })) },
      },
      select: { id: true },
    });
    purchaseId = purchase.id;
  } catch (err) {
    console.error("[createPurchase] DB error:", err);
    return { error: "A database error occurred. Please try again." };
  }

  const storagePath = `proof/${purchaseId}/proof.${image.ext}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET!)
    .upload(storagePath, image.buffer, {
      contentType: image.contentType,
      upsert: true,
    });
  if (uploadError) {
    console.error("[createPurchase] Supabase error:", uploadError);
    await db.purchase.delete({ where: { id: purchaseId } }).catch(() => {});
    return { error: "Failed to upload payment proof. Please try again." };
  }

  try {
    await db.purchase.update({
      where: { id: purchaseId },
      data: { paymentProofUrl: storagePath },
    });
  } catch (err) {
    console.error("[createPurchase] DB error (proof url):", err);
    return {
      error: "Payment uploaded but could not be saved. Please contact support.",
    };
  }

  try {
    await sendPurchaseConfirmationEmail({
      to: user.email,
      firstName: user.firstName,
      purchaseId,
    });
  } catch (err) {
    console.error("[createPurchase] Email error:", err);
  }

  redirect("/student/purchases");
}
```

- [ ] **Step 2: Verify (after Task 13 creates the email module, this will fully type-check)**

Run: `pnpm lint`
Expected: it will report a missing `@/lib/purchases/email` until Task 13. That's acceptable — implement Task 13 next, then re-run. If executing strictly in order, create a minimal stub now and complete it in Task 13.

- [ ] **Step 3: Commit**

```bash
git add lib/purchases/actions.ts
git commit -m "feat(purchases): add createPurchaseAction"
```

### Task 11: Browse + cart page

**Files:**

- Create: `app/(student)/student/courses/page.tsx`
- Create: `app/(student)/student/courses/cart.tsx`

- [ ] **Step 1: Create the server page**

```tsx
// app/(student)/student/courses/page.tsx
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getPurchasableCourses } from "@/lib/purchases/queries";
import { CourseCart } from "./cart";

export const metadata = { title: "Browse Courses — AQA" };

export default async function StudentCoursesPage() {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") redirect("/login");

  const courses = await getPurchasableCourses(session.userId);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Browse Courses</h1>
      <p className="text-muted-foreground text-sm mt-1">
        Select one or more courses to purchase.
      </p>
      <div className="mt-6">
        <CourseCart courses={courses} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the cart client component**

```tsx
// app/(student)/student/courses/cart.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { PurchasableCourse } from "@/lib/purchases/queries";

export function CourseCart({ courses }: { courses: PurchasableCourse[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const total = courses
    .filter((c) => selected.has(c.id))
    .reduce((sum, c) => sum + (c.tuitionFee ?? 0), 0);

  function checkout() {
    const ids = [...selected];
    if (ids.length === 0) return;
    router.push(`/student/checkout?ids=${ids.join(",")}`);
  }

  if (courses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No courses available to purchase right now.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {courses.map((c) => {
          const isSel = selected.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              aria-pressed={isSel}
              className={[
                "text-left rounded-xl border-2 p-4 transition-colors",
                isSel
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40",
              ].join(" ")}
            >
              <p className="font-semibold text-foreground">{c.title}</p>
              {c.description && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {c.description}
                </p>
              )}
              <p className="mt-2 text-sm font-bold text-foreground">
                {c.tuitionFee != null
                  ? `₱${c.tuitionFee.toLocaleString("en-PH")}`
                  : "Contact us for pricing"}
              </p>
            </button>
          );
        })}
      </div>

      <div className="sticky bottom-0 flex items-center justify-between rounded-xl border bg-card p-4">
        <div>
          <p className="text-xs text-muted-foreground">
            {selected.size} selected
          </p>
          <p className="text-lg font-bold">₱{total.toLocaleString("en-PH")}</p>
        </div>
        <Button onClick={checkout} disabled={selected.size === 0}>
          Proceed to checkout
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(student\)/student/courses
git commit -m "feat(student): add course browse + cart page"
```

### Task 12: Checkout page + form

**Files:**

- Create: `app/(student)/student/checkout/page.tsx`
- Create: `app/(student)/student/checkout/checkout-form.tsx`

- [ ] **Step 1: Create the server page**

```tsx
// app/(student)/student/checkout/page.tsx
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCheckoutCourses } from "@/lib/purchases/queries";
import { CheckoutForm } from "./checkout-form";

export const metadata = { title: "Checkout — AQA" };

type Props = { searchParams: Promise<{ ids?: string }> };

export default async function CheckoutPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") redirect("/login");

  const { ids } = await searchParams;
  const courseIds = (ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (courseIds.length === 0) redirect("/student/courses");

  const [courses, user] = await Promise.all([
    getCheckoutCourses(session.userId, courseIds),
    db.user.findUnique({
      where: { id: session.userId },
      select: { studentType: true },
    }),
  ]);
  if (courses.length === 0) redirect("/student/courses");

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Checkout</h1>
      <p className="text-muted-foreground text-sm mt-1">
        Review your selection, then upload your proof of payment.
      </p>
      <div className="mt-6">
        <CheckoutForm
          courses={courses}
          studentType={user?.studentType ?? "OLD"}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the checkout form**

```tsx
// app/(student)/student/checkout/checkout-form.tsx
"use client";

import { useState, useActionState } from "react";
import { createPurchaseAction } from "@/lib/purchases/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import type { CheckoutCourse } from "@/lib/purchases/queries";
import type { StudentType } from "@prisma/client";

type Props = { courses: CheckoutCourse[]; studentType: StudentType };

export function CheckoutForm({ courses, studentType }: Props) {
  const [state, formAction, isPending] = useActionState(createPurchaseAction, {
    error: null,
  });
  const isNew = studentType === "NEW";
  const [paymentType, setPaymentType] = useState<"FULL" | "PARTIAL">("FULL");
  const total = courses.reduce((s, c) => s + (c.tuitionFee ?? 0), 0);

  return (
    <form action={formAction} className="space-y-6">
      {courses.map((c) => (
        <input key={c.id} type="hidden" name="courseIds" value={c.id} />
      ))}

      <div className="rounded-xl border bg-card divide-y">
        {courses.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-4">
            <span className="font-medium text-foreground">{c.title}</span>
            <span className="text-sm font-semibold">
              {c.tuitionFee != null
                ? `₱${c.tuitionFee.toLocaleString("en-PH")}`
                : "—"}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between p-4">
          <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Total
          </span>
          <span className="text-lg font-bold">
            ₱{total.toLocaleString("en-PH")}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Payment Type</Label>
        {isNew ? (
          <>
            <input type="hidden" name="paymentType" value="FULL" />
            <div className="rounded-xl border-2 border-primary bg-primary/5 p-4 text-sm">
              <p className="font-semibold text-foreground">Full Payment</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                New students are required to pay in full.
              </p>
            </div>
          </>
        ) : (
          <div className="flex gap-3">
            {(["FULL", "PARTIAL"] as const).map((p) => (
              <label key={p} className="flex-1 cursor-pointer">
                <input
                  type="radio"
                  name="paymentType"
                  value={p}
                  checked={paymentType === p}
                  onChange={() => setPaymentType(p)}
                  className="peer sr-only"
                />
                <div
                  className={[
                    "rounded-xl border-2 p-4 text-center transition-colors",
                    paymentType === p
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card",
                  ].join(" ")}
                >
                  <p className="text-sm font-semibold text-foreground">
                    {p === "FULL" ? "Full Payment" : "Partial Payment"}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

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
        <p className="text-xs text-muted-foreground">
          JPG, PNG, or WEBP. Max 5MB.
        </p>
      </div>

      {state.error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          {state.error}
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="w-full h-11 font-semibold"
      >
        {isPending ? "Submitting…" : "Submit purchase"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Verify**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(student\)/student/checkout
git commit -m "feat(student): add checkout page with proof upload"
```

### Task 13: Purchase emails

**Files:**

- Create: `lib/purchases/email.ts`

- [ ] **Step 1: Implement the email module (no credentials in any body)**

```typescript
// lib/purchases/email.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendPurchaseConfirmationEmail(params: {
  to: string;
  firstName: string;
  purchaseId: string;
}): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/student/purchases`;
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.to,
    subject: "We received your course purchase — Al-Qur'an Academy",
    html: `<p>Assalamualaykum ${escapeHtml(params.firstName)},</p>
<p>We have received your course purchase and proof of payment. Our team will review it shortly.</p>
<p>You can track its status here: <a href="${url}">${url}</a></p>
<p>Best regards,<br>Al-Qur'an Academy Team</p>`,
  });
  if (error)
    throw new Error(
      `Failed to send purchase confirmation email: ${error.message}`,
    );
}

export async function sendPurchaseApprovalEmail(params: {
  to: string;
  firstName: string;
  courseNames: string[];
}): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/student/dashboard`;
  const list = params.courseNames
    .map((c) => `<li>${escapeHtml(c)}</li>`)
    .join("");
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.to,
    subject: "Your course purchase is approved — Al-Qur'an Academy",
    html: `<p>Assalamualaykum ${escapeHtml(params.firstName)},</p>
<p>Your purchase has been approved. You now have access to:</p>
<ul>${list}</ul>
<p>Log in to start learning: <a href="${url}">${url}</a></p>
<p>Welcome to Al-Qur'an Academy!</p>`,
  });
  if (error)
    throw new Error(`Failed to send purchase approval email: ${error.message}`);
}

export async function sendPurchaseRejectionEmail(params: {
  to: string;
  firstName: string;
  reason: string;
}): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/student/courses`;
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.to,
    subject: "Update on your course purchase — Al-Qur'an Academy",
    html: `<p>Assalamualaykum ${escapeHtml(params.firstName)},</p>
<p>Unfortunately, your recent course purchase could not be approved.</p>
<p><strong>Reason:</strong> ${escapeHtml(params.reason)}</p>
<p>You're welcome to submit a new purchase here: <a href="${url}">${url}</a></p>
<p>Best regards,<br>Al-Qur'an Academy Team</p>`,
  });
  if (error)
    throw new Error(
      `Failed to send purchase rejection email: ${error.message}`,
    );
}
```

- [ ] **Step 2: Verify (this also resolves the import in Task 10)**

Run: `pnpm lint`
Expected: no errors; `lib/purchases/actions.ts` now type-checks fully.

- [ ] **Step 3: Commit**

```bash
git add lib/purchases/email.ts
git commit -m "feat(purchases): add purchase notification emails"
```

### Task 14: Student purchases status page

**Files:**

- Create: `app/(student)/student/purchases/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// app/(student)/student/purchases/page.tsx
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getStudentPurchases } from "@/lib/purchases/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = { title: "My Purchases — AQA" };

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function StudentPurchasesPage() {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") redirect("/login");

  const purchases = await getStudentPurchases(session.userId);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">My Purchases</h1>
        <Button asChild size="sm">
          <Link href="/student/courses">Buy more courses</Link>
        </Button>
      </div>

      {purchases.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          You haven&apos;t purchased any courses yet.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {purchases.map((p) => (
            <div key={p.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {dateFmt.format(p.createdAt)}
                </p>
                {p.status === "APPROVED" ? (
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    Approved
                  </Badge>
                ) : p.status === "REJECTED" ? (
                  <Badge variant="destructive">Rejected</Badge>
                ) : (
                  <Badge variant="outline">Pending review</Badge>
                )}
              </div>
              <ul className="mt-2 list-disc pl-5 text-sm text-foreground">
                {p.courses.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm font-semibold">
                ₱{p.amountPaid.toLocaleString("en-PH")}{" "}
                <span className="font-normal text-muted-foreground">
                  ({p.paymentType === "FULL" ? "Full" : "Partial"})
                </span>
              </p>
              {p.status === "REJECTED" && p.adminRemarks && (
                <p className="mt-2 text-sm text-destructive">
                  <strong>Reason:</strong> {p.adminRemarks}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(student\)/student/purchases
git commit -m "feat(student): add purchase status page"
```

### Task 15: Student nav links

**Files:**

- Modify: `components/student/nav.tsx`

- [ ] **Step 1: Add Courses + Purchases links**

Inside the right-hand `<div className="flex items-center gap-4">`, before the `firstName` span, add:

```tsx
          <Link href="/student/dashboard" className="text-white/70 hover:text-white text-sm hidden sm:block">Dashboard</Link>
          <Link href="/student/courses" className="text-white/70 hover:text-white text-sm hidden sm:block">Courses</Link>
          <Link href="/student/purchases" className="text-white/70 hover:text-white text-sm hidden sm:block">Purchases</Link>
```

(`Link` is already imported.)

- [ ] **Step 2: Verify**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/student/nav.tsx
git commit -m "feat(student): add Courses and Purchases nav links"
```

---

## Phase 5 — Admin approval

### Task 16: Admin purchase queries

**Files:**

- Modify: `lib/purchases/queries.ts`

- [ ] **Step 1: Append admin queries**

```typescript
// append to lib/purchases/queries.ts

export type AdminPurchaseRow = {
  id: string;
  status: EnrollmentStatus;
  amountPaid: number;
  createdAt: Date;
  studentName: string;
  studentEmail: string;
  courseCount: number;
};

export async function getAdminPurchasesByStatus(
  status: EnrollmentStatus,
): Promise<AdminPurchaseRow[]> {
  const rows = await db.purchase.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      amountPaid: true,
      createdAt: true,
      user: { select: { firstName: true, lastName: true, email: true } },
      _count: { select: { items: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    amountPaid: r.amountPaid.toNumber(),
    createdAt: r.createdAt,
    studentName: `${r.user.firstName} ${r.user.lastName}`,
    studentEmail: r.user.email,
    courseCount: r._count.items,
  }));
}

export type AdminPurchaseDetail = {
  id: string;
  status: EnrollmentStatus;
  paymentType: PaymentType;
  amountPaid: number;
  paymentProofUrl: string;
  adminRemarks: string | null;
  createdAt: Date;
  student: {
    firstName: string;
    lastName: string;
    email: string;
    contactNumber: string | null;
  };
  courses: { id: string; title: string; tuitionFee: number | null }[];
};

export async function getAdminPurchaseById(
  id: string,
): Promise<AdminPurchaseDetail | null> {
  const r = await db.purchase.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      paymentType: true,
      amountPaid: true,
      paymentProofUrl: true,
      adminRemarks: true,
      createdAt: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          contactNumber: true,
        },
      },
      items: {
        select: {
          course: { select: { id: true, title: true, tuitionFee: true } },
        },
      },
    },
  });
  if (!r) return null;
  return {
    id: r.id,
    status: r.status,
    paymentType: r.paymentType,
    amountPaid: r.amountPaid.toNumber(),
    paymentProofUrl: r.paymentProofUrl,
    adminRemarks: r.adminRemarks,
    createdAt: r.createdAt,
    student: r.user,
    courses: r.items.map((i) => ({
      id: i.course.id,
      title: i.course.title,
      tuitionFee: i.course.tuitionFee?.toNumber() ?? null,
    })),
  };
}

export async function getPurchaseStatusCounts(): Promise<
  Record<string, number>
> {
  const grouped = await db.purchase.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  return Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
}
```

- [ ] **Step 2: Verify**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/purchases/queries.ts
git commit -m "feat(purchases): add admin purchase queries"
```

### Task 17: Admin approve/reject actions

**Files:**

- Create: `app/(admin)/admin/purchases/[id]/actions.ts`

- [ ] **Step 1: Implement the actions**

```typescript
// app/(admin)/admin/purchases/[id]/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { paymentStatusFromType } from "@/lib/purchases/payment";
import {
  sendPurchaseApprovalEmail,
  sendPurchaseRejectionEmail,
} from "@/lib/purchases/email";

type ActionState = { error: string | null; success?: boolean };

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { ok: false as const, error: "Unauthorized" };
  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
    return { ok: false as const, error: "Forbidden" };
  }
  return { ok: true as const, userId: session.userId };
}

export async function approvePurchaseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Invalid purchase ID." };

  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const purchase = await db.purchase.findUnique({
    where: { id },
    select: {
      paymentType: true,
      user: { select: { id: true, email: true, firstName: true } },
      items: {
        select: { courseId: true, course: { select: { title: true } } },
      },
    },
  });
  if (!purchase) return { error: "Purchase not found." };

  const paymentStatus = paymentStatusFromType(purchase.paymentType);

  try {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.purchase.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: "APPROVED",
          reviewedById: auth.userId,
          reviewedAt: new Date(),
        },
      });
      if (updated.count === 0) throw new Error("ALREADY_PROCESSED");

      for (const item of purchase.items) {
        // Skip if the student is already enrolled in this course.
        const exists = await tx.enrollment.findUnique({
          where: {
            userId_courseId: {
              userId: purchase.user.id,
              courseId: item.courseId,
            },
          },
          select: { id: true },
        });
        if (exists) continue;
        await tx.enrollment.create({
          data: {
            userId: purchase.user.id,
            courseId: item.courseId,
            paymentStatus,
            purchaseId: id,
          },
        });
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "ALREADY_PROCESSED")
      return { error: "This purchase has already been processed." };
    console.error("[approvePurchase] Transaction error:", err);
    return { error: "A database error occurred. Please try again." };
  }

  revalidatePath("/admin/purchases");

  try {
    await sendPurchaseApprovalEmail({
      to: purchase.user.email,
      firstName: purchase.user.firstName,
      courseNames: purchase.items.map((i) => i.course.title),
    });
  } catch (err) {
    console.error("[approvePurchase] Email error:", err);
    return {
      error:
        "Purchase approved but email delivery failed. Contact the student directly.",
      success: true,
    };
  }

  redirect("/admin/purchases");
}

export async function rejectPurchaseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Invalid purchase ID." };

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

  const purchase = await db.purchase.findUnique({
    where: { id },
    select: { user: { select: { email: true, firstName: true } } },
  });
  if (!purchase) return { error: "Purchase not found." };

  let result: { count: number };
  try {
    result = await db.purchase.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: "REJECTED",
        adminRemarks: reason,
        reviewedById: auth.userId,
        reviewedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("[rejectPurchase] DB error:", err);
    return { error: "A database error occurred. Please try again." };
  }
  if (result.count === 0)
    return { error: "This purchase has already been processed." };

  revalidatePath("/admin/purchases");

  try {
    await sendPurchaseRejectionEmail({
      to: purchase.user.email,
      firstName: purchase.user.firstName,
      reason,
    });
  } catch (err) {
    console.error("[rejectPurchase] Email error:", err);
    return {
      error: "Purchase rejected but notification email failed.",
      success: true,
    };
  }

  redirect("/admin/purchases");
}
```

- [ ] **Step 2: Verify**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/admin/purchases/\[id\]/actions.ts
git commit -m "feat(admin): add purchase approve/reject actions"
```

### Task 18: Admin purchases list page

**Files:**

- Create: `app/(admin)/admin/purchases/page.tsx`

- [ ] **Step 1: Create the list page** (modeled on the old enrollments list)

```tsx
// app/(admin)/admin/purchases/page.tsx
import { type EnrollmentStatus } from "@prisma/client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Inbox, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/admin/page-header";
import {
  getAdminPurchasesByStatus,
  getPurchaseStatusCounts,
} from "@/lib/purchases/queries";

type Props = { searchParams: Promise<{ tab?: string }> };

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const metadata = { title: "Purchases — AQA Admin" };

export default async function PurchasesPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const STATUS_MAP: Record<string, EnrollmentStatus> = {
    pending: "PENDING",
    approved: "APPROVED",
    rejected: "REJECTED",
  };
  const status: EnrollmentStatus = STATUS_MAP[tab ?? ""] ?? "PENDING";

  const [rows, countMap] = await Promise.all([
    getAdminPurchasesByStatus(status),
    getPurchaseStatusCounts(),
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
      <PageHeader title="Course Purchases" />

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
          <p className="text-sm">No {status.toLowerCase()} purchases.</p>
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
                  Email
                </th>
                <th
                  scope="col"
                  className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide"
                >
                  Courses
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
                  <td className="px-4 py-2 font-medium">{r.studentName}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {r.studentEmail}
                  </td>
                  <td className="px-4 py-2">{r.courseCount}</td>
                  <td className="px-4 py-2">
                    ₱{r.amountPaid.toLocaleString("en-PH")}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {dateFormatter.format(r.createdAt)}
                  </td>
                  <td className="px-4 py-2">{getStatusBadge(r.status)}</td>
                  <td className="px-4 py-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={"/admin/purchases/" + r.id}>
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

- [ ] **Step 2: Verify**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/admin/purchases/page.tsx
git commit -m "feat(admin): add purchases list page"
```

### Task 19: Admin purchase detail + approve/reject forms + proof image

**Files:**

- Create: `app/(admin)/admin/purchases/[id]/proof-image.tsx`
- Create: `app/(admin)/admin/purchases/[id]/approve-form.tsx`
- Create: `app/(admin)/admin/purchases/[id]/reject-form.tsx`
- Create: `app/(admin)/admin/purchases/[id]/page.tsx`

- [ ] **Step 1: Proof image component (fetches a signed URL from the API route in Task 20)**

```tsx
// app/(admin)/admin/purchases/[id]/proof-image.tsx
"use client";

import { useEffect, useState } from "react";

export function ProofImage({ purchaseId }: { purchaseId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/purchases/${purchaseId}/proof`)
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
  }, [purchaseId]);

  if (error)
    return (
      <p className="text-sm text-muted-foreground">
        Could not load proof image.
      </p>
    );
  if (!url) return <div className="h-48 animate-pulse rounded-lg bg-muted" />;
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img src={url} alt="Payment proof" className="max-h-96 rounded-lg border" />
  );
}
```

- [ ] **Step 2: Approve form**

```tsx
// app/(admin)/admin/purchases/[id]/approve-form.tsx
"use client";

import { useActionState } from "react";
import { approvePurchaseAction } from "./actions";
import { Button } from "@/components/ui/button";

export function ApproveForm({ id }: { id: string }) {
  const [state, action, isPending] = useActionState(approvePurchaseAction, {
    error: null,
  });
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {state.error && (
        <p className="mb-2 text-sm text-destructive">{state.error}</p>
      )}
      <Button
        type="submit"
        disabled={isPending}
        className="bg-green-600 hover:bg-green-700"
      >
        {isPending ? "Approving…" : "Approve purchase"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Reject form**

```tsx
// app/(admin)/admin/purchases/[id]/reject-form.tsx
"use client";

import { useActionState } from "react";
import { rejectPurchaseAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function RejectForm({ id }: { id: string }) {
  const [state, action, isPending] = useActionState(rejectPurchaseAction, {
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
        placeholder="Explain why this purchase is rejected"
      />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" variant="destructive" disabled={isPending}>
        {isPending ? "Rejecting…" : "Reject purchase"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Detail page**

```tsx
// app/(admin)/admin/purchases/[id]/page.tsx
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminPurchaseById } from "@/lib/purchases/queries";
import { ProofImage } from "./proof-image";
import { ApproveForm } from "./approve-form";
import { RejectForm } from "./reject-form";

type Props = { params: Promise<{ id: string }> };

export default async function PurchaseDetailPage({ params }: Props) {
  const { id } = await params;
  const purchase = await getAdminPurchaseById(id);
  if (!purchase) notFound();

  const isPending = purchase.status === "PENDING";

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <PageHeader title="Purchase Detail" />

      <div className="rounded-xl border bg-card p-4 space-y-1">
        <div className="flex items-center justify-between">
          <p className="font-semibold">
            {purchase.student.firstName} {purchase.student.lastName}
          </p>
          {purchase.status === "APPROVED" ? (
            <Badge className="bg-green-100 text-green-800 border-green-200">
              Approved
            </Badge>
          ) : purchase.status === "REJECTED" ? (
            <Badge variant="destructive">Rejected</Badge>
          ) : (
            <Badge variant="outline">Pending</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {purchase.student.email}
        </p>
        {purchase.student.contactNumber && (
          <p className="text-sm text-muted-foreground">
            {purchase.student.contactNumber}
          </p>
        )}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Courses
        </p>
        <ul className="divide-y">
          {purchase.courses.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span>{c.title}</span>
              <span className="font-semibold">
                {c.tuitionFee != null
                  ? `₱${c.tuitionFee.toLocaleString("en-PH")}`
                  : "—"}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
          <span className="text-muted-foreground">
            Amount paid ({purchase.paymentType === "FULL" ? "Full" : "Partial"})
          </span>
          <span className="text-lg font-bold">
            ₱{purchase.amountPaid.toLocaleString("en-PH")}
          </span>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Proof of payment
        </p>
        <ProofImage purchaseId={purchase.id} />
      </div>

      {purchase.status === "REJECTED" && purchase.adminRemarks && (
        <p className="text-sm text-destructive">
          <strong>Rejection reason:</strong> {purchase.adminRemarks}
        </p>
      )}

      {isPending && (
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
          <ApproveForm id={purchase.id} />
          <div className="border-t pt-4">
            <RejectForm id={purchase.id} />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/\(admin\)/admin/purchases/\[id\]
git commit -m "feat(admin): add purchase detail with approve/reject"
```

### Task 20: Admin purchase proof API route

**Files:**

- Create: `app/api/admin/purchases/[id]/proof/route.ts`

- [ ] **Step 1: Implement (modeled on the old enrollment proof route)**

```typescript
// app/api/admin/purchases/[id]/proof/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifySessionToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const token = req.cookies.get("session")?.value;
  const payload = token ? await verifySessionToken(token) : null;
  if (!payload)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const purchase = await db.purchase.findUnique({
    where: { id },
    select: { paymentProofUrl: true },
  });
  if (!purchase || !purchase.paymentProofUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET!)
    .createSignedUrl(purchase.paymentProofUrl, 300);
  if (error) {
    console.error("[purchases/proof] Supabase signed URL error:", error);
    return NextResponse.json(
      { error: "Failed to generate signed URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({ signedUrl: data.signedUrl });
}
```

- [ ] **Step 2: Verify**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/purchases
git commit -m "feat(admin): add purchase proof signed-url route"
```

### Task 21: Admin dashboard stat + nav rename

**Files:**

- Modify: `app/(admin)/admin/dashboard/page.tsx`
- Modify: admin sidebar/nav component

- [ ] **Step 1: Repoint the dashboard's pending count**

In `app/(admin)/admin/dashboard/page.tsx`, change the pending-count query from `db.enrollmentRequest.count({ where: { status: "PENDING" } })` to `db.purchase.count({ where: { status: "PENDING" } })`, and change the `db.enrollmentRequest.findMany(...)` recent-list query to `db.purchase.findMany(...)` (selecting `user`/`items` instead of `firstName`/`course`). Update the label from "Pending enrollments" to "Pending purchases" and the link target to `/admin/purchases`. Read the file first to match the exact JSX shape before editing.

- [ ] **Step 2: Rename the admin nav entry**

Find the admin sidebar/nav (search for the string `enrollments` under `components/admin/` or `app/(admin)/admin/layout*`): change the "Enrollments" link label to "Purchases" and its `href` from `/admin/enrollments` to `/admin/purchases`.

Run: `git grep -n "admin/enrollments\|Enrollments" -- components app/\(admin\)`

- [ ] **Step 3: Verify**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(admin\)/admin/dashboard/page.tsx components
git commit -m "feat(admin): point dashboard + nav at purchases"
```

---

## Phase 6 — Dashboard query update

### Task 22: Update student dashboard query (drop totalPaid/paymentProofs)

**Files:**

- Modify: `lib/student/queries.ts`
- Modify: `app/(student)/student/dashboard/page.tsx` (consumers of removed fields)

- [ ] **Step 1: Update the dashboard query types and select**

In `lib/student/queries.ts`:

- Remove `DashboardPaymentProof` type and the `paymentProofs` and `totalPaid` fields from `DashboardEnrollment`.
- In `getStudentDashboard`, remove `totalPaid: true` and the `paymentProofs: { ... }` select block from the `db.enrollment.findMany` call.
- In the `enrollments.map(...)`, remove the `totalPaid` and `paymentProofs` properties from the returned object.

Resulting `DashboardEnrollment`:

```typescript
export type DashboardEnrollment = {
  id: string;
  courseId: string;
  course: { title: string; imageUrl: string | null; tuitionFee: number | null };
  paymentStatus: "PARTIALLY_PAID" | "FULLY_PAID";
  enrolledAt: Date;
  totalLessons: number;
  completedLessons: number;
};
```

- [ ] **Step 2: Fix the dashboard page**

Read `app/(student)/student/dashboard/page.tsx`. Remove any rendering of `totalPaid` or `paymentProofs` (e.g. payment-history UI / "₱ paid" text). Keep the `paymentStatus` badge. Replace any "upload additional proof" affordance with a link to `/student/purchases`.

- [ ] **Step 3: Verify**

Run: `pnpm lint && pnpm build`
Expected: build succeeds (this surfaces any other consumer of the removed fields — fix as needed).

- [ ] **Step 4: Commit**

```bash
git add lib/student/queries.ts app/\(student\)/student/dashboard/page.tsx
git commit -m "refactor(student): drop per-enrollment payment fields from dashboard"
```

---

## Phase 7 — Removals

### Task 23: Delete the old public enroll flow

**Files:**

- Delete: `app/(public)/courses/[id]/enroll/` (page + enroll-form)
- Delete: `app/(public)/enroll/` (subtree)
- Delete: `lib/enrollments/actions.ts`

- [ ] **Step 1: Remove the directories and file**

```bash
git rm -r "app/(public)/courses/[id]/enroll" "app/(public)/enroll" lib/enrollments/actions.ts
```

- [ ] **Step 2: Fix public course CTAs**

Read `app/(public)/courses/page.tsx` (and any course card/CTA). Replace links/buttons pointing to `/courses/[id]/enroll` with a link to `/register` ("Register to purchase") for logged-out visitors. Also update the login page's mobile CTA if it still references `/courses` enroll wording (handled in Task 8 — verify).

Run: `git grep -n "courses/.*enroll\|/enroll\|submitEnrollmentAction\|uploadProofAction"`
Expected: no remaining references except in deleted/spec/plan files. Fix any in live code.

- [ ] **Step 3: Verify**

Run: `pnpm lint && pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove old public enrollment flow"
```

### Task 24: Delete the old admin enrollment subtree, queries, emails, proof routes

**Files:**

- Delete: `app/(admin)/admin/enrollments/` (subtree)
- Delete: `lib/enrollments/queries.ts`, `lib/enrollments/email.ts`, `lib/enrollments/password.ts`
- Delete: `app/api/admin/enrollments/[id]/proof/route.ts`, `app/api/admin/payment-proof/[proofId]/route.ts`, `app/api/student/payment-proof/[proofId]/route.ts`

- [ ] **Step 1: Remove them**

```bash
git rm -r "app/(admin)/admin/enrollments" \
  lib/enrollments/queries.ts lib/enrollments/email.ts lib/enrollments/password.ts \
  "app/api/admin/enrollments" \
  "app/api/admin/payment-proof" \
  "app/api/student/payment-proof"
```

- [ ] **Step 2: Find and fix dangling references**

Run: `git grep -n "lib/enrollments\|admin/enrollments\|payment-proof\|generateTempPassword\|getEnrollmentRequest\|getStudentEnrollment\|getEnrollmentPaymentByRequest"`
Expected: no references in live code (only in `docs/`). Fix any that remain (e.g. an import of a deleted query). The `lib/enrollments/` folder should now be empty — remove it if so.

- [ ] **Step 3: Verify**

Run: `pnpm lint && pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove old admin enrollment approval + proof routes"
```

---

## Phase 8 — Final verification

### Task 25: Full verification pass

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test --run`
Expected: all tests pass (image, payment, schema, middleware, plus pre-existing auth tests).

- [ ] **Step 2: Lint and build**

Run: `pnpm lint && pnpm build`
Expected: no lint errors; production build succeeds.

- [ ] **Step 3: Manual smoke test (dev server)**

Run: `pnpm dev`, then verify the full flow:

1. Visit `/register`, create a student account → lands on `/student/courses`.
2. Select 2 courses → `/student/checkout` shows both + total.
3. Choose payment type, enter amount, upload a JPG/PNG → redirects to `/student/purchases` showing a **Pending** purchase.
4. Confirm the purchased courses are **not** accessible yet (not on dashboard; direct course URL returns not-found/redirect).
5. Log in as an admin → `/admin/purchases` shows the pending purchase; open it, view the proof image.
6. **Approve** → student dashboard now lists both courses and they're accessible.
7. Repeat with another purchase and **Reject** with a reason → student's `/student/purchases` shows **Rejected** + reason; courses remain inaccessible.

- [ ] **Step 4: Final commit (if any smoke-test fixes were needed)**

```bash
git add -A
git commit -m "fix: address smoke-test findings for purchase flow"
```

---

## Self-Review Notes (author checklist — completed)

- **Spec coverage:** registration (T5–T8), profile on User (T1), no email verify / own password (T5), cart one-proof (T11–T12), partial/full + amount order-level (T3, T4, T10), admin approve+reject (T17–T19), Enrollment created on approval (T17), removals of EnrollmentRequest/PaymentProof/totalPaid (T1, T22–T24), destructive migration (T1), emails without credentials (T13), nav Courses link (T15), homepage/course CTA change (T23). All covered.
- **Placeholder scan:** none — every code step contains full code; the only "read the file first" steps (T21, T22, T23) are deliberate because they edit existing JSX whose exact shape must be matched.
- **Type consistency:** `validateImageUpload` result shape, `paymentStatusFromType`, `createPurchaseSchema`/`registerSchema`, and the `PurchasableCourse`/`CheckoutCourse`/`AdminPurchase*` query types are defined once and consumed consistently across tasks.
- **Ordering caveat:** Task 10 imports `lib/purchases/email.ts` created in Task 13; noted inline. If executed strictly in isolation, create the email module before lint-gating Task 10 (or accept the one expected lint failure until Task 13).
