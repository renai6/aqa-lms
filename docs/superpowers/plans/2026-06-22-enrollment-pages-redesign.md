# Enrollment Pages Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the enroll form page and confirmation page to match the three-band layout (dark hero → light content → dark footer band) introduced in the `/courses` redesign.

**Architecture:** Three file changes, each committed independently. The enroll page layout (`page.tsx`) is rewritten as a server component with a course-image hero. The form (`enroll-form.tsx`) stays a client component with visual upgrades. The confirmation page (`page.tsx`) is rewritten with a green-tinted hero and upgraded cards.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 (utility classes only), lucide-react, shadcn/ui (`Card`, `Input`, `Label`).

---

## File Map

| Action | Path                                               | Responsibility                                                                                |
| ------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Modify | `app/(public)/courses/[id]/enroll/page.tsx`        | Server component — hero with course image + form section + footer band                        |
| Modify | `app/(public)/courses/[id]/enroll/enroll-form.tsx` | Client component — course info strip, payment toggle cards, styled error, rounded-full button |
| Modify | `app/(public)/enroll/[requestId]/page.tsx`         | Server component — green hero + upgraded cards + footer band                                  |

---

### Task 1: Rewrite enroll page layout

**Files:**

- Modify: `app/(public)/courses/[id]/enroll/page.tsx`

The current `page.tsx` is a plain `max-w-lg` wrapper. Replace it with the three-band layout. The `EnrollForm` component import and props are unchanged.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `app/(public)/courses/[id]/enroll/page.tsx` with:

```tsx
import { notFound } from "next/navigation";
import { getPublishedCourseById } from "@/lib/enrollments/queries";
import { EnrollForm } from "./enroll-form";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const course = await getPublishedCourseById(id);
  return {
    title: course
      ? `Enroll in ${course.title} — Al-Qur'an Academy`
      : "Enroll — Al-Qur'an Academy",
  };
}

export default async function EnrollPage({ params }: Props) {
  const { id } = await params;
  const course = await getPublishedCourseById(id);
  if (!course) notFound();

  const hasImage = !!course.imageUrl && /^https?:\/\//.test(course.imageUrl);

  return (
    <>
      {/* ── Hero Banner ── */}
      <section className="relative flex min-h-[40vh] items-center bg-zinc-900 pt-20 pb-24">
        {/* Course image background */}
        {hasImage && (
          <img
            src={course.imageUrl!}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {/* Dark overlay — always rendered so text stays readable */}
        <div className="absolute inset-0 bg-black/60" />

        {/* Grain texture */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.04] mix-blend-overlay"
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="grain-enroll-hero">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-enroll-hero)" />
        </svg>

        {/* Crimson radial glow */}
        <div
          className="pointer-events-none absolute top-0 left-0 h-96 w-96 rounded-full"
          style={{
            background:
              "radial-gradient(circle, oklch(0.525 0.223 3.958 / 0.2) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 mx-auto w-full max-w-lg px-4 sm:px-6">
          <span className="border-primary/20 bg-primary/10 text-primary inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold">
            Enrollment Application
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Enroll in {course.title}
          </h1>
          <p className="mt-3 max-w-xl text-base text-white/70">
            Complete the form below to submit your enrollment application.
            You&apos;ll receive a confirmation email once submitted.
          </p>
        </div>
      </section>

      {/* ── Form Section ── */}
      <section className="bg-background">
        <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
          <EnrollForm
            courseId={course.id}
            courseTitle={course.title}
            tuitionFee={course.tuitionFee}
          />
        </div>
      </section>

      {/* ── Footer Band ── */}
      <section className="bg-zinc-900 px-4 py-10">
        <p className="mx-auto max-w-xl text-center text-sm text-white/70">
          Your application will be reviewed by our team within 1–2 business
          days. You&apos;ll receive an email update at the address you provided.
        </p>
      </section>
    </>
  );
}
```

- [ ] **Step 2: Lint the file**

```bash
npx eslint "app/(public)/courses/[id]/enroll/page.tsx"
```

Expected: 0 errors, at most 1 warning (`no-img-element` — expected, same as the courses page).

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/courses/[id]/enroll/page.tsx"
git commit -m "feat: redesign enroll page — course image hero, three-band layout"
```

---

### Task 2: Upgrade the enroll form

**Files:**

- Modify: `app/(public)/courses/[id]/enroll/enroll-form.tsx`

Replace the plain radio buttons with styled toggle cards, upgrade the course info strip, style the error message, and change the submit button to `rounded-full`. The form action, field names, and server action are unchanged.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `app/(public)/courses/[id]/enroll/enroll-form.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { useActionState } from "react";
import { submitEnrollmentAction } from "@/lib/enrollments/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Banknote, CreditCard } from "lucide-react";

type Props = {
  courseId: string;
  courseTitle: string;
  tuitionFee: number | null;
};

export function EnrollForm({ courseId, courseTitle, tuitionFee }: Props) {
  const [state, formAction, isPending] = useActionState(
    submitEnrollmentAction,
    { error: null },
  );
  const [paymentType, setPaymentType] = useState<"FULL" | "PARTIAL">("FULL");

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="courseId" value={courseId} />

      {/* Course info strip */}
      <div className="bg-card rounded-xl border p-4">
        <p className="text-foreground font-semibold">{courseTitle}</p>
        {tuitionFee != null ? (
          <>
            <span className="text-foreground text-lg font-bold">
              ₱{tuitionFee.toLocaleString("en-PH")}
            </span>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Flexible installments available
            </p>
          </>
        ) : (
          <p className="text-muted-foreground mt-1 text-sm">
            Contact us for pricing
          </p>
        )}
      </div>

      {/* First Name */}
      <div className="space-y-2">
        <Label htmlFor="firstName">First Name</Label>
        <Input id="firstName" name="firstName" required placeholder="Ahmad" />
      </div>

      {/* Last Name */}
      <div className="space-y-2">
        <Label htmlFor="lastName">Last Name</Label>
        <Input id="lastName" name="lastName" required placeholder="Bayan" />
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          placeholder="ahmad@example.com"
        />
      </div>

      {/* Payment Type — styled toggle cards */}
      <div className="space-y-2">
        <Label>Payment Type</Label>
        <div className="flex gap-3">
          {/* Full Payment */}
          <label className="flex-1 cursor-pointer">
            <input
              type="radio"
              name="paymentType"
              value="FULL"
              checked={paymentType === "FULL"}
              onChange={() => setPaymentType("FULL")}
              className="sr-only"
            />
            <div
              className={[
                "rounded-xl border-2 p-4 transition-colors",
                paymentType === "FULL"
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card",
              ].join(" ")}
            >
              <Banknote className="text-primary mb-2 h-5 w-5" />
              <p className="text-foreground text-sm font-semibold">
                Full Payment
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Pay the full tuition upfront
              </p>
            </div>
          </label>

          {/* Partial Payment */}
          <label className="flex-1 cursor-pointer">
            <input
              type="radio"
              name="paymentType"
              value="PARTIAL"
              checked={paymentType === "PARTIAL"}
              onChange={() => setPaymentType("PARTIAL")}
              className="sr-only"
            />
            <div
              className={[
                "rounded-xl border-2 p-4 transition-colors",
                paymentType === "PARTIAL"
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card",
              ].join(" ")}
            >
              <CreditCard className="text-primary mb-2 h-5 w-5" />
              <p className="text-foreground text-sm font-semibold">
                Partial Payment
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Pay a portion now, rest later
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Amount */}
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

      {/* Error */}
      {state.error && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-full px-6 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {isPending ? "Submitting..." : "Submit Application"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Lint the file**

```bash
npx eslint "app/(public)/courses/[id]/enroll/enroll-form.tsx"
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/courses/[id]/enroll/enroll-form.tsx"
git commit -m "feat: upgrade enroll form — payment toggle cards, styled error, rounded button"
```

---

### Task 3: Rewrite confirmation page

**Files:**

- Modify: `app/(public)/enroll/[requestId]/page.tsx`

Replace the plain card stack with the three-band layout: green-tinted hero → upgraded cards → dark footer band. The `UploadProofForm` import and the payment constants are unchanged.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `app/(public)/enroll/[requestId]/page.tsx` with:

```tsx
import { notFound } from "next/navigation";
import { getEnrollmentRequestById } from "@/lib/enrollments/queries";
import { UploadProofForm } from "./upload-proof-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Smartphone, Building2 } from "lucide-react";

type Props = { params: Promise<{ requestId: string }> };

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

// Update these with the academy's actual payment details before deploying
const GCASH_NUMBER = "09XX-XXX-XXXX";
const GCASH_NAME = "Admin Name";
const BANK_NAME = "BDO";
const BANK_ACCOUNT_NO = "XXXX-XXXX-XXXX";
const BANK_ACCOUNT_NAME = "Academy Name";

export async function generateMetadata({ params }: Props) {
  const { requestId } = await params;
  const request = await getEnrollmentRequestById(requestId);
  return {
    title: request
      ? `Enrollment — ${request.firstName} ${request.lastName} — Al-Qur'an Academy`
      : "Enrollment Confirmation — Al-Qur'an Academy",
  };
}

export default async function EnrollmentConfirmationPage({ params }: Props) {
  const { requestId } = await params;
  const request = await getEnrollmentRequestById(requestId);
  if (!request) notFound();

  return (
    <>
      {/* ── Hero Banner ── */}
      <section
        className="relative flex min-h-[40vh] items-center bg-zinc-900 pt-20 pb-24"
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 88%, 0 100%)" }}
      >
        {/* Grain texture */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.04] mix-blend-overlay"
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="grain-confirm-hero">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-confirm-hero)" />
        </svg>

        {/* Emerald radial glow */}
        <div
          className="pointer-events-none absolute top-0 left-0 h-96 w-96 rounded-full"
          style={{
            background:
              "radial-gradient(circle, oklch(0.7 0.2 160 / 0.25) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 mx-auto w-full max-w-2xl px-4 sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Application Received
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            You&apos;re all set, {request.firstName}!
          </h1>
          <p className="mt-3 max-w-xl text-base text-white/70">
            Complete your payment and upload proof below. We&apos;ll notify you
            by email once verified.
          </p>
        </div>
      </section>

      {/* ── Cards Section ── */}
      <section className="bg-background">
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-12 sm:px-6">
          {/* Application Summary */}
          <Card className="border-primary border-l-4">
            <CardHeader>
              <CardTitle>Your Application</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex gap-4">
                <span className="text-muted-foreground w-28 shrink-0">
                  Name
                </span>
                <span className="font-medium">
                  {request.firstName} {request.lastName}
                </span>
              </div>
              <div className="flex gap-4">
                <span className="text-muted-foreground w-28 shrink-0">
                  Email
                </span>
                <span className="font-medium">{request.email}</span>
              </div>
              <div className="flex gap-4">
                <span className="text-muted-foreground w-28 shrink-0">
                  Course
                </span>
                <span className="font-medium">{request.course.title}</span>
              </div>
              <div className="flex gap-4">
                <span className="text-muted-foreground w-28 shrink-0">
                  Submitted
                </span>
                <span className="font-medium">
                  {dateFormatter.format(request.createdAt)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="bg-muted space-y-0.5 rounded-lg p-3">
                <div className="flex items-center gap-2 font-medium">
                  <Smartphone className="text-muted-foreground h-4 w-4" />
                  GCash
                </div>
                <p className="text-muted-foreground pl-6">
                  {GCASH_NUMBER} — {GCASH_NAME}
                </p>
              </div>
              <div className="bg-muted space-y-0.5 rounded-lg p-3">
                <div className="flex items-center gap-2 font-medium">
                  <Building2 className="text-muted-foreground h-4 w-4" />
                  {BANK_NAME} Bank Transfer
                </div>
                <p className="text-muted-foreground pl-6">
                  Account No: {BANK_ACCOUNT_NO}
                </p>
                <p className="text-muted-foreground pl-6">
                  Account Name: {BANK_ACCOUNT_NAME}
                </p>
              </div>
              <p className="text-muted-foreground pt-1 text-xs">
                After payment, upload your screenshot or receipt below. You will
                be notified by email once your payment is verified.
              </p>
            </CardContent>
          </Card>

          {/* Upload Proof */}
          <Card>
            <CardHeader>
              <CardTitle>Upload Proof of Payment</CardTitle>
            </CardHeader>
            <CardContent>
              {request.paymentProofUrl ? (
                <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  Proof of payment already received. We will notify you by email
                  once reviewed.
                </p>
              ) : (
                <UploadProofForm requestId={requestId} />
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Footer Band ── */}
      <section className="bg-zinc-900 px-4 py-10">
        <p className="mx-auto max-w-xl text-center text-sm text-white/70">
          Questions about your application? Reach out to us and we&apos;ll be
          happy to help.
        </p>
      </section>
    </>
  );
}
```

- [ ] **Step 2: Lint the file**

```bash
npx eslint "app/(public)/enroll/[requestId]/page.tsx"
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/enroll/[requestId]/page.tsx"
git commit -m "feat: redesign confirmation page — green hero, upgraded cards, footer band"
```
