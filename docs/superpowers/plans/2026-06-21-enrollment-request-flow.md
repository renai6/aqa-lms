# Enrollment Request Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public-facing enrollment flow — course listing, enrollment form, confirmation page with payment instructions, and proof-of-payment upload.

**Architecture:** Six new files plus modifications to existing queries and email modules. Public pages live under `app/(public)/` with a shared Navbar/Footer layout. Two server actions handle form submission and Supabase Storage upload. The Supabase admin client (already wired at `lib/supabase/admin.ts`) uploads proof to a private bucket; the admin's existing proof viewer reads it back via signed URL.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 7, Zod 4, Tailwind CSS 4, shadcn/ui, Supabase Storage, Resend (email).

---

## File Map

| File                                                    | Action | Responsibility                                                            |
| ------------------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| `lib/enrollments/queries.ts`                            | Modify | Add `PublishedCourseRow`, `getPublishedCourses`, `getPublishedCourseById` |
| `lib/enrollments/email.ts`                              | Modify | Add `sendEnrollmentConfirmationEmail`                                     |
| `lib/enrollments/actions.ts`                            | Create | `submitEnrollmentAction`, `uploadProofAction`                             |
| `app/(public)/layout.tsx`                               | Create | Public layout: Navbar + Footer                                            |
| `app/(public)/courses/page.tsx`                         | Create | Published course listing (server component)                               |
| `app/(public)/courses/[id]/enroll/page.tsx`             | Create | Enrollment form page (server component)                                   |
| `app/(public)/courses/[id]/enroll/enroll-form.tsx`      | Create | Enrollment form (client component)                                        |
| `app/(public)/enroll/[requestId]/page.tsx`              | Create | Confirmation + payment instructions + upload (server component)           |
| `app/(public)/enroll/[requestId]/upload-proof-form.tsx` | Create | Proof upload form (client component)                                      |

---

### Task 1: Data layer — published course queries

**Files:**

- Modify: `lib/enrollments/queries.ts`

- [ ] **Step 1: Add `PublishedCourseRow` type and two query functions**

Open `lib/enrollments/queries.ts`. Add after the existing imports, before the first type definition:

```ts
export type PublishedCourseRow = {
  id: string;
  title: string;
  description: string | null;
};

export async function getPublishedCourses(): Promise<PublishedCourseRow[]> {
  return db.course.findMany({
    where: { isPublished: true },
    orderBy: { title: "asc" },
    select: { id: true, title: true, description: true },
  });
}

export async function getPublishedCourseById(
  id: string,
): Promise<PublishedCourseRow | null> {
  return db.course.findFirst({
    where: { id, isPublished: true },
    select: { id: true, title: true, description: true },
  });
}
```

Use `findFirst` (not `findUnique`) because the `where` clause combines `id` with `isPublished` — Prisma requires `findFirst` for filters that include non-unique fields.

- [ ] **Step 2: Verify build is clean**

```bash
pnpm build 2>&1 | grep -E "error TS|Error:" | head -20
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add lib/enrollments/queries.ts
git commit -m "feat: add getPublishedCourses and getPublishedCourseById queries"
```

---

### Task 2: Email — enrollment confirmation

**Files:**

- Modify: `lib/enrollments/email.ts`

- [ ] **Step 1: Add `sendEnrollmentConfirmationEmail`**

Open `lib/enrollments/email.ts`. The file already has `escapeHtml`, `sendEnrollmentApprovalEmail`, and `sendEnrollmentRejectionEmail`. Append after the last function:

```ts
export async function sendEnrollmentConfirmationEmail(params: {
  to: string;
  firstName: string;
  courseName: string;
  requestId: string;
}): Promise<void> {
  const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL}/enroll/${params.requestId}`;
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.to,
    subject: "We received your enrollment application — Al-Qur'an Academy",
    html: `<p>Assalamualaykum ${escapeHtml(params.firstName)},</p>
<p>Thank you for applying to <strong>${escapeHtml(params.courseName)}</strong> at Al-Qur'an Academy. We have received your enrollment application.</p>
<p>To complete your enrollment, please pay the course fee and upload your proof of payment using the link below:</p>
<p><a href="${confirmUrl}">${confirmUrl}</a></p>
<p>We will notify you by email once your payment has been verified and your enrollment is confirmed.</p>
<p>Best regards,<br>Al-Qur'an Academy Team</p>`,
  });
  if (error)
    throw new Error(
      `Failed to send enrollment confirmation email: ${error.message}`,
    );
}
```

Payment instructions are not included in the email body — the confirmation link leads to the page which shows them. This avoids duplicating hardcoded bank details in two places.

- [ ] **Step 2: Verify build is clean**

```bash
pnpm build 2>&1 | grep -E "error TS|Error:" | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/enrollments/email.ts
git commit -m "feat: add sendEnrollmentConfirmationEmail"
```

---

### Task 3: Server actions — submitEnrollmentAction and uploadProofAction

**Files:**

- Create: `lib/enrollments/actions.ts`

- [ ] **Step 1: Create `lib/enrollments/actions.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEnrollmentConfirmationEmail } from "./email";

type ActionState = { error: string | null; success?: boolean };

// ─── submitEnrollmentAction ───────────────────────────────────────────────────

const enrollSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  email: z.string().email("A valid email address is required."),
  courseId: z.string().min(1, "Course is required."),
});

export async function submitEnrollmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    courseId: formData.get("courseId"),
  };

  const result = enrollSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Validation failed." };
  }

  const { firstName, lastName, email, courseId } = result.data;

  const course = await db.course.findFirst({
    where: { id: courseId, isPublished: true },
    select: { title: true },
  });
  if (!course) return { error: "Course not found." };

  // Block re-apply only for PENDING or APPROVED; REJECTED allows a new application
  const duplicate = await db.enrollmentRequest.findFirst({
    where: { email, courseId, status: { in: ["PENDING", "APPROVED"] } },
  });
  if (duplicate) return { error: "You have already applied for this course." };

  let requestId: string;
  try {
    const request = await db.enrollmentRequest.create({
      data: { firstName, lastName, email, courseId },
    });
    requestId = request.id;
  } catch (err) {
    console.error("[submitEnrollment] DB error:", err);
    return { error: "A database error occurred. Please try again." };
  }

  // Email failure does not block the flow — request is already created
  try {
    await sendEnrollmentConfirmationEmail({
      to: email,
      firstName,
      courseName: course.title,
      requestId,
    });
  } catch (err) {
    console.error("[submitEnrollment] Email error:", err);
  }

  redirect("/enroll/" + requestId);
}

// ─── uploadProofAction ────────────────────────────────────────────────────────

export async function uploadProofAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const requestId = formData.get("requestId");
  if (typeof requestId !== "string" || !requestId) {
    return { error: "Invalid request ID." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please select a file to upload." };
  }

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: "Only JPG, PNG, and WEBP images are accepted." };
  }

  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return { error: "File size must be 5MB or less." };
  }

  const request = await db.enrollmentRequest.findUnique({
    where: { id: requestId },
    select: { status: true },
  });
  if (!request) return { error: "Enrollment request not found." };
  if (request.status === "APPROVED" || request.status === "REJECTED") {
    return { error: "This enrollment request has already been processed." };
  }

  const storagePath = `proof/${requestId}/${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET!)
    .upload(storagePath, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error("[uploadProof] Supabase error:", uploadError);
    return { error: "Failed to upload file. Please try again." };
  }

  try {
    await db.enrollmentRequest.update({
      where: { id: requestId },
      data: { paymentProofUrl: storagePath },
    });
  } catch (err) {
    console.error("[uploadProof] DB error:", err);
    return {
      error:
        "File uploaded but record could not be saved. Please contact support.",
    };
  }

  return { error: null, success: true };
}
```

- [ ] **Step 2: Verify build is clean**

```bash
pnpm build 2>&1 | grep -E "error TS|Error:" | head -20
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add lib/enrollments/actions.ts
git commit -m "feat: add submitEnrollmentAction and uploadProofAction"
```

---

### Task 4: Public layout and courses listing page

**Files:**

- Create: `app/(public)/layout.tsx`
- Create: `app/(public)/courses/page.tsx`

- [ ] **Step 1: Create `app/(public)/layout.tsx`**

This layout wraps all routes under `app/(public)/` (i.e. `/courses`, `/courses/[id]/enroll`, `/enroll/[requestId]`) with the site Navbar and Footer. Routes outside `(public)/` (like the homepage at `app/page.tsx`) are unaffected.

```tsx
import Navbar from "@/components/homepage/Navbar";
import Footer from "@/components/homepage/Footer";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 2: Create `app/(public)/courses/page.tsx`**

```tsx
import Link from "next/link";
import { getPublishedCourses } from "@/lib/enrollments/queries";

export const metadata = { title: "Courses — Al-Qur'an Academy" };

export default async function CoursesPage() {
  const courses = await getPublishedCourses();

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Courses</h1>
        <p className="text-muted-foreground mt-2">
          Browse our available courses and apply for enrollment.
        </p>
      </div>

      {courses.length === 0 ? (
        <p className="text-muted-foreground">
          No courses available at this time.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <div
              key={course.id}
              className="border rounded-lg p-6 space-y-4 flex flex-col"
            >
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
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build is clean**

```bash
pnpm build 2>&1 | grep -E "error TS|Error:" | head -20
```

Expected: no errors. `/courses` appears in the route table.

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/layout.tsx" "app/(public)/courses/page.tsx"
git commit -m "feat: add public layout and courses listing page"
```

---

### Task 5: Enrollment form page and client component

**Files:**

- Create: `app/(public)/courses/[id]/enroll/enroll-form.tsx`
- Create: `app/(public)/courses/[id]/enroll/page.tsx`

- [ ] **Step 1: Create `app/(public)/courses/[id]/enroll/enroll-form.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { submitEnrollmentAction } from "@/lib/enrollments/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { courseId: string; courseTitle: string };

export function EnrollForm({ courseId, courseTitle }: Props) {
  const [state, formAction, isPending] = useActionState(
    submitEnrollmentAction,
    { error: null },
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <div className="p-3 bg-muted rounded-md text-sm">
        <span className="text-muted-foreground">Enrolling in: </span>
        <strong>{courseTitle}</strong>
      </div>
      <div className="space-y-2">
        <Label htmlFor="firstName">First Name</Label>
        <Input id="firstName" name="firstName" required placeholder="Juan" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lastName">Last Name</Label>
        <Input id="lastName" name="lastName" required placeholder="dela Cruz" />
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
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Submitting..." : "Submit Application"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Create `app/(public)/courses/[id]/enroll/page.tsx`**

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

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-2">Enrollment Application</h1>
      <p className="text-muted-foreground mb-8">
        Fill in your details below to apply for enrollment.
      </p>
      <EnrollForm courseId={course.id} courseTitle={course.title} />
    </div>
  );
}
```

- [ ] **Step 3: Verify build is clean**

```bash
pnpm build 2>&1 | grep -E "error TS|Error:" | head -20
```

Expected: no errors. `/courses/[id]/enroll` appears in the route table.

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/courses/[id]/enroll/enroll-form.tsx" "app/(public)/courses/[id]/enroll/page.tsx"
git commit -m "feat: add enrollment form page and EnrollForm component"
```

---

### Task 6: Confirmation page and proof upload component

**Files:**

- Create: `app/(public)/enroll/[requestId]/upload-proof-form.tsx`
- Create: `app/(public)/enroll/[requestId]/page.tsx`

Before committing, update the five payment constants at the top of `page.tsx` with the academy's actual GCash number and bank account details.

- [ ] **Step 1: Create `app/(public)/enroll/[requestId]/upload-proof-form.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { uploadProofAction } from "@/lib/enrollments/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { requestId: string };

export function UploadProofForm({ requestId }: Props) {
  const [state, formAction, isPending] = useActionState(uploadProofAction, {
    error: null,
  });

  if (state.success) {
    return (
      <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-3">
        Thank you — your proof of payment has been received. We will notify you
        by email once reviewed.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="requestId" value={requestId} />
      <div className="space-y-2">
        <Label htmlFor="file">Select image file</Label>
        <Input
          id="file"
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
        />
        <p className="text-xs text-muted-foreground">
          Accepted: JPG, PNG, WEBP. Max 5MB.
        </p>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Uploading..." : "Upload Proof of Payment"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Create `app/(public)/enroll/[requestId]/page.tsx`**

Update the five constants below the imports with the academy's actual payment details before deploying.

```tsx
import { notFound } from "next/navigation";
import { getEnrollmentRequestById } from "@/lib/enrollments/queries";
import { UploadProofForm } from "./upload-proof-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

export const metadata = {
  title: "Enrollment Confirmation — Al-Qur'an Academy",
};

export default async function EnrollmentConfirmationPage({ params }: Props) {
  const { requestId } = await params;
  const request = await getEnrollmentRequestById(requestId);
  if (!request) notFound();

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Application Received</h1>
        <p className="text-muted-foreground mt-1">
          Please complete your payment and upload proof below.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Application</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex gap-4">
            <span className="text-muted-foreground w-28 shrink-0">Name</span>
            <span>
              {request.firstName} {request.lastName}
            </span>
          </div>
          <div className="flex gap-4">
            <span className="text-muted-foreground w-28 shrink-0">Email</span>
            <span>{request.email}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-muted-foreground w-28 shrink-0">Course</span>
            <span>{request.course.title}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-muted-foreground w-28 shrink-0">
              Submitted
            </span>
            <span>{dateFormatter.format(request.createdAt)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-medium">GCash</p>
            <p className="text-muted-foreground">
              {GCASH_NUMBER} — {GCASH_NAME}
            </p>
          </div>
          <div>
            <p className="font-medium">{BANK_NAME} Bank Transfer</p>
            <p className="text-muted-foreground">
              Account No: {BANK_ACCOUNT_NO}
            </p>
            <p className="text-muted-foreground">
              Account Name: {BANK_ACCOUNT_NAME}
            </p>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            After payment, upload your screenshot or receipt below. You will be
            notified by email once your payment is verified.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload Proof of Payment</CardTitle>
        </CardHeader>
        <CardContent>
          {request.paymentProofUrl ? (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-3">
              Proof of payment already received. We will notify you by email
              once reviewed.
            </p>
          ) : (
            <UploadProofForm requestId={requestId} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Verify build is clean**

```bash
pnpm build 2>&1 | grep -E "error TS|Error:" | head -20
```

Expected: no errors. `/enroll/[requestId]` appears in the route table.

- [ ] **Step 4: Manual end-to-end verification**

```bash
pnpm dev
```

1. Navigate to `/courses` — confirm course card grid renders (publish a course in `/admin/courses` first if none are published)
2. Click "Enroll Now" → confirm redirect to `/courses/[id]/enroll`
3. Submit the form with valid data → confirm redirect to `/enroll/[requestId]`
4. Confirm the confirmation page shows applicant name, email, course, and payment instructions
5. Upload a JPG/PNG — confirm "Proof of payment received" success message appears
6. In Supabase Storage, confirm the file exists at `proof/[requestId]/[filename]`
7. In the admin panel at `/admin/enrollments` → confirm the request appears under "Pending" with the "View Proof of Payment" button functional
8. Submit the enrollment form a second time with the same email + course → confirm "You have already applied for this course." error
9. Try uploading a PDF → confirm "Only JPG, PNG, and WEBP images are accepted." error
10. Try uploading a file over 5MB → confirm "File size must be 5MB or less." error

- [ ] **Step 5: Commit**

```bash
git add "app/(public)/enroll/[requestId]/upload-proof-form.tsx" "app/(public)/enroll/[requestId]/page.tsx"
git commit -m "feat: add enrollment confirmation page with payment instructions and proof upload"
```
