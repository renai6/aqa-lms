# Partial & Full Payment Enrollment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add partial/full payment tracking to enrollment — students declare payment type and amount upfront, admins confirm status on approval, enrolled students can submit additional proofs from their dashboard, and payment status updates trigger email notifications.

**Architecture:** New `PaymentType`/`PaymentStatus` enums and a `PaymentProof` model extend the existing enrollment flow. Enrollment form gets payment type + amount fields; approval flow gets a payment status selector; student dashboard gets a payment history section with additional proof upload; admin enrollment detail gets a payment management panel.

**Tech Stack:** Next.js 16 App Router, Prisma 7, PostgreSQL, Supabase Storage, Resend, Zod 4, shadcn/ui, TypeScript

---

## File Map

| File                                                                | Action                                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `prisma/schema.prisma`                                              | Add enums, fields, PaymentProof model                              |
| `lib/courses/queries.ts`                                            | Add `tuitionFee` to `CourseDetail` type + `getCourseById`          |
| `app/(admin)/admin/courses/actions.ts`                              | Add `tuitionFee` to `updateCourseAction` + `courseSchema`          |
| `app/(admin)/admin/courses/[id]/edit-course-form.tsx`               | Add tuition fee field                                              |
| `lib/enrollments/actions.ts`                                        | Update `submitEnrollmentAction` schema + DB write                  |
| `app/(public)/courses/[id]/enroll/page.tsx`                         | Pass `tuitionFee` to `EnrollForm`                                  |
| `app/(public)/courses/[id]/enroll/enroll-form.tsx`                  | Add payment type + amount fields                                   |
| `lib/enrollments/queries.ts`                                        | Add payment-related query functions + update existing              |
| `app/(admin)/admin/enrollments/[id]/actions.ts`                     | Update `approveEnrollmentAction` + add `updatePaymentStatusAction` |
| `app/(admin)/admin/enrollments/[id]/approve-form.tsx`               | Replace `approve-button.tsx` with form including payment status    |
| `app/(admin)/admin/enrollments/[id]/payment-section.tsx`            | New — admin payment history + update form (server component)       |
| `app/(admin)/admin/enrollments/[id]/update-payment-status-form.tsx` | New — client form                                                  |
| `app/(admin)/admin/enrollments/[id]/page.tsx`                       | Show payment info + payment section                                |
| `app/(student)/student/dashboard/page.tsx`                          | Add payment section                                                |
| `app/(student)/student/dashboard/actions.ts`                        | New — `submitAdditionalPaymentAction`                              |
| `app/(student)/student/dashboard/additional-payment-form.tsx`       | New — client upload form                                           |
| `app/api/student/payment-proof/[proofId]/route.ts`                  | New — signed URL for student's own proofs                          |
| `app/api/admin/payment-proof/[proofId]/route.ts`                    | New — signed URL for admin viewing additional proofs               |
| `lib/enrollments/email.ts`                                          | Add payment status notification emails                             |

---

## Task 1: Schema — enums, fields, PaymentProof model

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new enums after the existing enums block**

In `prisma/schema.prisma`, add after the `DayOfWeek` enum (around line 62):

```prisma
enum PaymentType {
  PARTIAL
  FULL
}

enum PaymentStatus {
  PARTIALLY_PAID
  FULLY_PAID
}
```

- [ ] **Step 2: Add `tuitionFee` to the Course model**

In the `Course` model (after `passingGrade`):

```prisma
  passingGrade Float   @default(75.0)
  tuitionFee   Decimal?
```

- [ ] **Step 3: Add payment fields to EnrollmentRequest**

In the `EnrollmentRequest` model, add after `paymentProofUrl`:

```prisma
  paymentType PaymentType @default(FULL)
  amountPaid  Decimal     @default(0)
```

- [ ] **Step 4: Add payment fields to Enrollment and link PaymentProof**

Replace the `Enrollment` model with:

```prisma
model Enrollment {
  id String @id @default(cuid())

  userId String
  user   User   @relation(fields: [userId], references: [id])

  courseId String
  course   Course @relation(fields: [courseId], references: [id])

  enrolledAt  DateTime  @default(now())
  completedAt DateTime?

  progress Float @default(0)

  paymentStatus PaymentStatus @default(PARTIALLY_PAID)
  totalPaid     Decimal       @default(0)

  paymentProofs PaymentProof[]

  @@unique([userId, courseId])
}
```

- [ ] **Step 5: Add the PaymentProof model**

Add after the `Enrollment` model block (before the `//` ASSESSMENTS comment):

```prisma
model PaymentProof {
  id           String     @id @default(cuid())
  enrollmentId String
  enrollment   Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  proofUrl     String
  amount       Decimal
  note         String?
  submittedAt  DateTime   @default(now())

  @@index([enrollmentId])
}
```

- [ ] **Step 6: Run migration**

```bash
pnpm prisma migrate dev --name add-payment-tracking
```

Expected: migration applied, Prisma client regenerated.

- [ ] **Step 7: Verify migration succeeded**

```bash
pnpm prisma studio
```

Open in browser and confirm `PaymentProof` table exists and `Enrollment` has `paymentStatus`/`totalPaid` columns.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add PaymentType, PaymentStatus enums, PaymentProof model, payment fields to Enrollment/EnrollmentRequest/Course"
```

---

## Task 2: Course tuition fee — query type, action, form

**Files:**

- Modify: `lib/courses/queries.ts`
- Modify: `app/(admin)/admin/courses/actions.ts`
- Modify: `app/(admin)/admin/courses/[id]/edit-course-form.tsx`

- [ ] **Step 1: Update `CourseDetail` type and `getCourseById` in `lib/courses/queries.ts`**

Add `tuitionFee: number | null` to `CourseDetail`:

```ts
export type CourseDetail = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  isPublished: boolean;
  passingGrade: number;
  tuitionFee: number | null;
  createdAt: Date;
  updatedAt: Date;
  subjects: SubjectRow[];
};
```

Update `getCourseById` to select and convert `tuitionFee`:

```ts
export async function getCourseById(id: string): Promise<CourseDetail | null> {
  const raw = await db.course.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      isPublished: true,
      passingGrade: true,
      tuitionFee: true,
      createdAt: true,
      updatedAt: true,
      subjects: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          order: true,
          units: true,
          _count: {
            select: { lessons: true },
          },
        },
      },
    },
  });
  if (!raw) return null;
  return {
    ...raw,
    tuitionFee: raw.tuitionFee ? raw.tuitionFee.toNumber() : null,
  };
}
```

- [ ] **Step 2: Update `courseSchema` and `updateCourseAction` in `app/(admin)/admin/courses/actions.ts`**

Add `tuitionFee` to the schema (after `passingGrade`):

```ts
const courseSchema = z.object({
  title: z.string().min(1, "Title is required."),
  description: z.string().optional(),
  passingGrade: z.coerce
    .number()
    .min(0, "Must be at least 0.")
    .max(100, "Must be at most 100."),
  tuitionFee: z.coerce
    .number()
    .min(0, "Tuition fee cannot be negative.")
    .optional(),
});
```

In `updateCourseAction`, update the destructure and db call:

```ts
  const { title, description, passingGrade, tuitionFee } = result.data

  try {
    await db.course.update({
      where: { id },
      data: {
        title,
        description: description || null,
        passingGrade,
        tuitionFee: tuitionFee ?? null,
      },
    })
  }
```

In `createCourseAction`, also pass `tuitionFee`:

```ts
const raw = {
  title: formData.get("title"),
  description: formData.get("description"),
  passingGrade: formData.get("passingGrade") ?? "75",
  tuitionFee: formData.get("tuitionFee"),
};
// ...
const { title, description, passingGrade, tuitionFee } = result.data;
newCourse = await db.course.create({
  data: {
    title,
    description: description || null,
    passingGrade,
    tuitionFee: tuitionFee ?? null,
  },
  select: { id: true },
});
```

- [ ] **Step 3: Add tuition fee field to `app/(admin)/admin/courses/[id]/edit-course-form.tsx`**

Add after the passing grade field:

```tsx
<div className="space-y-2">
  <Label htmlFor="edit-tuitionFee">Tuition Fee (₱)</Label>
  <Input
    id="edit-tuitionFee"
    name="tuitionFee"
    type="number"
    min="0"
    step="0.01"
    defaultValue={course.tuitionFee !== null ? String(course.tuitionFee) : ""}
    placeholder="e.g. 10000"
  />
  <p className="text-xs text-muted-foreground">
    Leave blank if not applicable.
  </p>
</div>
```

- [ ] **Step 4: Verify in browser**

Start dev server (`pnpm dev`), open `/admin/courses/[id]`, confirm Tuition Fee field appears and saving updates the value.

- [ ] **Step 5: Commit**

```bash
git add lib/courses/queries.ts app/(admin)/admin/courses/actions.ts "app/(admin)/admin/courses/[id]/edit-course-form.tsx"
git commit -m "feat: add tuitionFee to Course — query, action, admin form"
```

---

## Task 3: Enrollment form — payment type + amount

**Files:**

- Modify: `lib/enrollments/actions.ts`
- Modify: `app/(public)/courses/[id]/enroll/page.tsx`
- Modify: `app/(public)/courses/[id]/enroll/enroll-form.tsx`

- [ ] **Step 1: Update `enrollSchema` and `submitEnrollmentAction` in `lib/enrollments/actions.ts`**

Replace the schema and action:

```ts
const enrollSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  email: z.string().email("A valid email address is required."),
  courseId: z.string().min(1, "Course is required."),
  paymentType: z.enum(["PARTIAL", "FULL"], {
    error: "Please select a payment type.",
  }),
  amountPaid: z.coerce.number().positive("Amount paid must be greater than 0."),
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
    paymentType: formData.get("paymentType"),
    amountPaid: formData.get("amountPaid"),
  };

  const result = enrollSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Validation failed." };
  }

  const { firstName, lastName, email, courseId, paymentType, amountPaid } =
    result.data;

  const course = await db.course.findFirst({
    where: { id: courseId, isPublished: true },
    select: { title: true },
  });
  if (!course) return { error: "Course not found." };

  const duplicate = await db.enrollmentRequest.findFirst({
    where: { email, courseId, status: { in: ["PENDING", "APPROVED"] } },
  });
  if (duplicate) return { error: "You have already applied for this course." };

  let requestId: string;
  try {
    const request = await db.enrollmentRequest.create({
      data: { firstName, lastName, email, courseId, paymentType, amountPaid },
    });
    requestId = request.id;
  } catch (err) {
    console.error("[submitEnrollment] DB error:", err);
    return { error: "A database error occurred. Please try again." };
  }

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
```

- [ ] **Step 2: Update `app/(public)/courses/[id]/enroll/page.tsx` to fetch and pass `tuitionFee`**

Read the current file first, then update the page to pass `tuitionFee` from the course query:

```ts
import { getPublishedCourseById } from '@/lib/enrollments/queries'
// ...
// In the page, after fetching the course:
const course = await getPublishedCourseById(id)
// ...
<EnrollForm courseId={course.id} courseTitle={course.title} tuitionFee={course.tuitionFee} />
```

First update `getPublishedCourseById` in `lib/enrollments/queries.ts` to return `tuitionFee`:

```ts
export type PublishedCourseRow = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  tuitionFee: number | null;
};

export async function getPublishedCourses(): Promise<PublishedCourseRow[]> {
  const rows = await db.course.findMany({
    where: { isPublished: true },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      tuitionFee: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    tuitionFee: r.tuitionFee?.toNumber() ?? null,
  }));
}

export async function getPublishedCourseById(
  id: string,
): Promise<PublishedCourseRow | null> {
  const course = await db.course.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      isPublished: true,
      tuitionFee: true,
    },
  });
  if (!course?.isPublished) return null;
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    imageUrl: course.imageUrl,
    tuitionFee: course.tuitionFee?.toNumber() ?? null,
  };
}
```

- [ ] **Step 3: Update `EnrollForm` in `app/(public)/courses/[id]/enroll/enroll-form.tsx`**

Replace the full component:

```tsx
"use client";

import { useActionState } from "react";
import { submitEnrollmentAction } from "@/lib/enrollments/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <div className="p-3 bg-muted rounded-md text-sm">
        <span className="text-muted-foreground">Enrolling in: </span>
        <strong>{courseTitle}</strong>
        {tuitionFee !== null && (
          <span className="block text-muted-foreground mt-1">
            Tuition fee: <strong>₱{tuitionFee.toLocaleString("en-PH")}</strong>
          </span>
        )}
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
      <div className="space-y-2">
        <Label>Payment Type</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="paymentType"
              value="FULL"
              defaultChecked
              className="accent-primary"
            />
            <span className="text-sm">Full Payment</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="paymentType"
              value="PARTIAL"
              className="accent-primary"
            />
            <span className="text-sm">Partial Payment</span>
          </label>
        </div>
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
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Submitting..." : "Submit Application"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Verify in browser**

Open `/courses/[id]/enroll`, confirm payment type radios and amount field appear, submit a test enrollment, check DB for `paymentType` and `amountPaid` on the created `EnrollmentRequest`.

- [ ] **Step 5: Commit**

```bash
git add lib/enrollments/actions.ts lib/enrollments/queries.ts "app/(public)/courses/[id]/enroll/enroll-form.tsx" "app/(public)/courses/[id]/enroll/page.tsx"
git commit -m "feat: add payment type and amount to enrollment form"
```

---

## Task 4: Admin approval — payment status selector + updated action

**Files:**

- Modify: `app/(admin)/admin/enrollments/[id]/actions.ts`
- Modify: `lib/enrollments/queries.ts`
- Replace: `app/(admin)/admin/enrollments/[id]/approve-button.tsx` → `approve-form.tsx`
- Modify: `app/(admin)/admin/enrollments/[id]/page.tsx`

- [ ] **Step 1: Update `getEnrollmentRequestById` in `lib/enrollments/queries.ts` to include payment fields**

Update the return type and select:

```ts
export type EnrollmentRequestDetail = EnrollmentRequestRow & {
  courseId: string;
  paymentProofUrl: string | null;
  paymentType: "PARTIAL" | "FULL";
  amountPaid: number;
  adminRemarks: string | null;
  userId: string | null;
  updatedAt: Date;
};

export async function getEnrollmentRequestById(
  id: string,
): Promise<EnrollmentRequestDetail | null> {
  const raw = await db.enrollmentRequest.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      createdAt: true,
      courseId: true,
      course: { select: { title: true } },
      paymentProofUrl: true,
      paymentType: true,
      amountPaid: true,
      adminRemarks: true,
      userId: true,
      updatedAt: true,
    },
  });
  if (!raw) return null;
  return { ...raw, amountPaid: raw.amountPaid.toNumber() };
}
```

- [ ] **Step 2: Update `approveEnrollmentAction` in `app/(admin)/admin/enrollments/[id]/actions.ts`**

Replace the existing function (keep `rejectEnrollmentAction` unchanged):

```ts
export async function approveEnrollmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id)
    return { error: "Invalid enrollment request ID." };

  const paymentStatusRaw = formData.get("paymentStatus");
  if (
    paymentStatusRaw !== "PARTIALLY_PAID" &&
    paymentStatusRaw !== "FULLY_PAID"
  ) {
    return { error: "Please select a payment status." };
  }
  const paymentStatus = paymentStatusRaw;

  const session = await getSession();
  if (!session) return { error: "Unauthorized" };
  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")
    return { error: "Forbidden" };

  const request = await db.enrollmentRequest.findUnique({
    where: { id },
    include: { course: { select: { title: true } } },
  });
  if (!request) return { error: "Enrollment request not found." };

  const tempPassword = generateTempPassword();
  const hashedPassword = await hashPassword(tempPassword);

  let newUser: { id: string };
  try {
    newUser = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.enrollmentRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "APPROVED" },
      });
      if (updated.count === 0) throw new Error("ALREADY_PROCESSED");

      const user = await tx.user.create({
        data: {
          email: request.email,
          firstName: request.firstName,
          lastName: request.lastName,
          passwordHash: hashedPassword,
          role: "STUDENT",
          isActive: true,
          mustChangePassword: true,
        },
      });

      const enrollment = await tx.enrollment.create({
        data: {
          userId: user.id,
          courseId: request.courseId,
          paymentStatus,
          totalPaid: request.amountPaid,
        },
      });

      if (request.paymentProofUrl) {
        await tx.paymentProof.create({
          data: {
            enrollmentId: enrollment.id,
            proofUrl: request.paymentProofUrl,
            amount: request.amountPaid,
            note: "Initial payment (submitted at enrollment)",
          },
        });
      }

      await tx.enrollmentRequest.update({
        where: { id },
        data: { userId: user.id },
      });

      return user;
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "ALREADY_PROCESSED")
      return { error: "This request has already been processed." };
    if (msg.includes("P2002") || msg.includes("Unique constraint")) {
      return { error: "A user with this email already exists." };
    }
    console.error("[approveEnrollment] Transaction error:", err);
    return { error: "A database error occurred. Please try again." };
  }

  revalidatePath("/admin/enrollments");

  try {
    await sendEnrollmentApprovalEmail({
      to: request.email,
      firstName: request.firstName,
      courseName: request.course.title,
      tempPassword,
    });
  } catch (err) {
    console.error("Failed to send enrollment approval email:", err);
    return {
      error:
        "Account created but email delivery failed. Contact the student directly.",
      success: true,
    };
  }

  redirect("/admin/enrollments");
}
```

- [ ] **Step 3: Create `app/(admin)/admin/enrollments/[id]/approve-form.tsx`** (replaces `approve-button.tsx`)

```tsx
"use client";

import { useActionState } from "react";
import { approveEnrollmentAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Props = {
  requestId: string;
  defaultPaymentStatus: "PARTIALLY_PAID" | "FULLY_PAID";
};

export function ApproveForm({ requestId, defaultPaymentStatus }: Props) {
  const [state, formAction, isPending] = useActionState(
    approveEnrollmentAction,
    { error: null },
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={requestId} />
      <div className="space-y-2">
        <Label htmlFor="paymentStatus">Set Payment Status</Label>
        <select
          id="paymentStatus"
          name="paymentStatus"
          defaultValue={defaultPaymentStatus}
          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
        >
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="FULLY_PAID">Fully Paid</option>
        </select>
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Processing..." : "Approve Enrollment"}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
```

- [ ] **Step 4: Update the admin enrollment detail page `app/(admin)/admin/enrollments/[id]/page.tsx`**

Replace `ApproveButton` import with `ApproveForm`, and show payment intent fields:

```tsx
import { ApproveForm } from "./approve-form";
// remove: import { ApproveButton } from './approve-button'
```

In the Applicant Information card, add payment intent rows after `Submitted`:

```tsx
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="text-sm text-muted-foreground w-32 shrink-0">Payment Type</span>
                <span className="text-sm">
                  {request.paymentType === 'FULL' ? 'Full Payment' : 'Partial Payment'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="text-sm text-muted-foreground w-32 shrink-0">Amount Paid</span>
                <span className="text-sm">₱{request.amountPaid.toLocaleString('en-PH')}</span>
              </div>
```

Replace `<ApproveButton requestId={id} />` with:

```tsx
<ApproveForm
  requestId={id}
  defaultPaymentStatus={
    request.paymentType === "FULL" ? "FULLY_PAID" : "PARTIALLY_PAID"
  }
/>
```

- [ ] **Step 5: Delete the old `approve-button.tsx`**

```bash
rm "app/(admin)/admin/enrollments/[id]/approve-button.tsx"
```

- [ ] **Step 6: Verify in browser**

Open a PENDING enrollment in `/admin/enrollments/[id]`. Confirm payment type and amount are displayed, the approve section shows a status dropdown, and approving creates the enrollment, PaymentProof, and sets paymentStatus correctly in the DB.

- [ ] **Step 7: Commit**

```bash
git add lib/enrollments/queries.ts "app/(admin)/admin/enrollments/[id]/actions.ts" "app/(admin)/admin/enrollments/[id]/approve-form.tsx" "app/(admin)/admin/enrollments/[id]/page.tsx"
git rm "app/(admin)/admin/enrollments/[id]/approve-button.tsx"
git commit -m "feat: admin approval flow — payment status selector, create PaymentProof on approve"
```

---

## Task 5: Payment queries — enrollment + payment data

**Files:**

- Modify: `lib/enrollments/queries.ts`

- [ ] **Step 1: Add payment-related types and query functions**

Add to `lib/enrollments/queries.ts`:

```ts
import { EnrollmentStatus, PaymentStatus } from "@prisma/client";

export type PaymentProofRow = {
  id: string;
  proofUrl: string;
  amount: number;
  note: string | null;
  submittedAt: Date;
};

export type StudentEnrollmentDetail = {
  id: string;
  courseId: string;
  course: { title: string; tuitionFee: number | null };
  paymentStatus: PaymentStatus;
  totalPaid: number;
  enrolledAt: Date;
  paymentProofs: PaymentProofRow[];
};

export async function getStudentEnrollment(
  userId: string,
): Promise<StudentEnrollmentDetail | null> {
  const raw = await db.enrollment.findFirst({
    where: { userId },
    select: {
      id: true,
      courseId: true,
      course: { select: { title: true, tuitionFee: true } },
      paymentStatus: true,
      totalPaid: true,
      enrolledAt: true,
      paymentProofs: {
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          proofUrl: true,
          amount: true,
          note: true,
          submittedAt: true,
        },
      },
    },
  });
  if (!raw) return null;
  return {
    ...raw,
    course: {
      title: raw.course.title,
      tuitionFee: raw.course.tuitionFee?.toNumber() ?? null,
    },
    totalPaid: raw.totalPaid.toNumber(),
    paymentProofs: raw.paymentProofs.map((p) => ({
      ...p,
      amount: p.amount.toNumber(),
    })),
  };
}

export type AdminEnrollmentPaymentDetail = {
  enrollmentId: string;
  paymentStatus: PaymentStatus;
  totalPaid: number;
  course: { tuitionFee: number | null };
  paymentProofs: PaymentProofRow[];
};

export async function getEnrollmentPaymentByRequest(
  userId: string,
  courseId: string,
): Promise<AdminEnrollmentPaymentDetail | null> {
  const raw = await db.enrollment.findFirst({
    where: { userId, courseId },
    select: {
      id: true,
      paymentStatus: true,
      totalPaid: true,
      course: { select: { tuitionFee: true } },
      paymentProofs: {
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          proofUrl: true,
          amount: true,
          note: true,
          submittedAt: true,
        },
      },
    },
  });
  if (!raw) return null;
  return {
    enrollmentId: raw.id,
    paymentStatus: raw.paymentStatus,
    totalPaid: raw.totalPaid.toNumber(),
    course: { tuitionFee: raw.course.tuitionFee?.toNumber() ?? null },
    paymentProofs: raw.paymentProofs.map((p) => ({
      ...p,
      amount: p.amount.toNumber(),
    })),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/enrollments/queries.ts
git commit -m "feat: add getStudentEnrollment and getEnrollmentPaymentByRequest queries"
```

---

## Task 6: Student dashboard — payment section + additional proof upload

**Files:**

- Modify: `app/(student)/student/dashboard/page.tsx`
- Create: `app/(student)/student/dashboard/actions.ts`
- Create: `app/(student)/student/dashboard/additional-payment-form.tsx`
- Create: `app/api/student/payment-proof/[proofId]/route.ts`

- [ ] **Step 1: Create `app/(student)/student/dashboard/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

type ActionState = { error: string | null; success?: boolean };

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_SIZE = 5 * 1024 * 1024;

function validateImageMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const h = new Uint8Array(buffer.slice(0, 12));
  if (mimeType === "image/jpeg")
    return h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff;
  if (mimeType === "image/png")
    return h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47;
  if (mimeType === "image/webp") {
    return (
      h[0] === 0x52 &&
      h[1] === 0x49 &&
      h[2] === 0x46 &&
      h[3] === 0x46 &&
      h[8] === 0x57 &&
      h[9] === 0x45 &&
      h[10] === 0x42 &&
      h[11] === 0x50
    );
  }
  return false;
}

export async function submitAdditionalPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };
  if (session.role !== "STUDENT") return { error: "Forbidden" };

  const amountRaw = formData.get("amount");
  const amount = parseFloat(typeof amountRaw === "string" ? amountRaw : "");
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Amount must be greater than 0." };
  }

  const note =
    typeof formData.get("note") === "string"
      ? (formData.get("note") as string).trim() || null
      : null;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { error: "Please select a file to upload." };
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return { error: "Only JPG, PNG, and WEBP images are accepted." };
  }
  if (file.size > MAX_SIZE) return { error: "File size must be 5MB or less." };

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!validateImageMagicBytes(buffer, file.type)) {
    return {
      error: "Invalid image file. Only JPG, PNG, and WEBP images are accepted.",
    };
  }

  const enrollment = await db.enrollment.findFirst({
    where: { userId: session.id },
    select: { id: true, paymentStatus: true },
  });
  if (!enrollment) return { error: "Enrollment not found." };
  if (enrollment.paymentStatus === "FULLY_PAID") {
    return { error: "Your enrollment is already fully paid." };
  }

  const timestamp = Date.now();
  const storagePath = `proof/${enrollment.id}/${timestamp}.${EXT[file.type]}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET!)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[additionalPayment] Supabase error:", uploadError);
    return { error: "Failed to upload file. Please try again." };
  }

  try {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.paymentProof.create({
        data: {
          enrollmentId: enrollment.id,
          proofUrl: storagePath,
          amount,
          note,
        },
      });
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { totalPaid: { increment: amount } },
      });
    });
  } catch (err) {
    console.error("[additionalPayment] DB error:", err);
    return {
      error:
        "File uploaded but record could not be saved. Please contact support.",
    };
  }

  revalidatePath("/student/dashboard");
  return { error: null, success: true };
}
```

- [ ] **Step 2: Create `app/(student)/student/dashboard/additional-payment-form.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { submitAdditionalPaymentAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdditionalPaymentForm() {
  const [state, formAction, isPending] = useActionState(
    submitAdditionalPaymentAction,
    { error: null },
  );

  if (state.success) {
    return (
      <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-3">
        Payment proof submitted. An admin will review it and update your payment
        status.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="amount">Amount Paid (₱)</Label>
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
        <Label htmlFor="note">Note (optional)</Label>
        <Input
          id="note"
          name="note"
          placeholder="e.g. 2nd installment via GCash"
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
          Accepted: JPG, PNG, WEBP. Max 5MB.
        </p>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Uploading..." : "Submit Payment Proof"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Update `app/(student)/student/dashboard/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getStudentEnrollment } from "@/lib/enrollments/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdditionalPaymentForm } from "./additional-payment-form";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function StudentDashboardPage() {
  const session = await getSession();
  if (!session) notFound();

  const enrollment = await getStudentEnrollment(session.id);

  return (
    <main className="p-8 max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Student Dashboard</h1>

      {!enrollment && (
        <p className="text-muted-foreground">No active enrollment found.</p>
      )}

      {enrollment && (
        <Card>
          <CardHeader>
            <CardTitle>My Enrollment & Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{enrollment.course.title}</p>
                <p className="text-sm text-muted-foreground">
                  Enrolled {dateFormatter.format(enrollment.enrolledAt)}
                </p>
              </div>
              <Badge
                className={
                  enrollment.paymentStatus === "FULLY_PAID"
                    ? "bg-green-100 text-green-800 border-green-200"
                    : "bg-yellow-100 text-yellow-800 border-yellow-200"
                }
              >
                {enrollment.paymentStatus === "FULLY_PAID"
                  ? "Fully Paid"
                  : "Partially Paid"}
              </Badge>
            </div>

            <div className="text-sm">
              <span className="text-muted-foreground">Total Paid: </span>
              <strong>₱{enrollment.totalPaid.toLocaleString("en-PH")}</strong>
              {enrollment.course.tuitionFee !== null && (
                <span className="text-muted-foreground">
                  {" "}
                  of ₱{enrollment.course.tuitionFee.toLocaleString("en-PH")}
                </span>
              )}
            </div>

            {enrollment.paymentProofs.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Payment History</p>
                <div className="divide-y border rounded-md">
                  {enrollment.paymentProofs.map((proof) => (
                    <div
                      key={proof.id}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-medium">
                          ₱{proof.amount.toLocaleString("en-PH")}
                        </span>
                        {proof.note && (
                          <span className="text-muted-foreground ml-2">
                            — {proof.note}
                          </span>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {dateFormatter.format(proof.submittedAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {enrollment.paymentStatus === "PARTIALLY_PAID" && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">
                  Submit Additional Payment
                </p>
                <AdditionalPaymentForm />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Create `app/api/student/payment-proof/[proofId]/route.ts`**

```ts
import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifySessionToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ proofId: string }> },
): Promise<NextResponse> {
  const { proofId } = await params;

  const token = req.cookies.get("session")?.value;
  const payload = token ? await verifySessionToken(token) : null;
  if (!payload)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (payload.role !== "STUDENT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const proof = await db.paymentProof.findUnique({
    where: { id: proofId },
    select: { proofUrl: true, enrollment: { select: { userId: true } } },
  });

  if (!proof) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (proof.enrollment.userId !== payload.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET!)
    .createSignedUrl(proof.proofUrl, 300);

  if (error)
    return NextResponse.json(
      { error: "Failed to generate signed URL" },
      { status: 500 },
    );

  return NextResponse.json({ signedUrl: data.signedUrl });
}
```

- [ ] **Step 5: Verify in browser**

Log in as an approved student, open `/student/dashboard`. Confirm payment status badge, total paid, payment history, and the upload form appears when partially paid. Submit an additional payment proof, confirm a new PaymentProof row appears in DB and `totalPaid` is updated.

- [ ] **Step 6: Commit**

```bash
git add "app/(student)/student/dashboard/page.tsx" "app/(student)/student/dashboard/actions.ts" "app/(student)/student/dashboard/additional-payment-form.tsx" "app/api/student/payment-proof/[proofId]/route.ts"
git commit -m "feat: student dashboard payment section and additional proof upload"
```

---

## Task 7: Admin payment management — payment section + update status action

**Files:**

- Modify: `app/(admin)/admin/enrollments/[id]/actions.ts`
- Create: `app/(admin)/admin/enrollments/[id]/payment-section.tsx`
- Create: `app/(admin)/admin/enrollments/[id]/update-payment-status-form.tsx`
- Create: `app/api/admin/payment-proof/[proofId]/route.ts`
- Modify: `app/(admin)/admin/enrollments/[id]/page.tsx`

- [ ] **Step 1: Add `sendPaymentStatusEmail` stub to `lib/enrollments/email.ts` first**

Add this at the end of `lib/enrollments/email.ts` so the import in the next step resolves. Task 8 will flesh out the full implementation.

```ts
export async function sendPaymentStatusEmail(_params: {
  to: string;
  firstName: string;
  courseName: string;
  paymentStatus: "PARTIALLY_PAID" | "FULLY_PAID";
  totalPaid: number;
  tuitionFee: number | null;
}): Promise<void> {
  // Full implementation added in Task 8
}
```

- [ ] **Step 2: Add `updatePaymentStatusAction` to `app/(admin)/admin/enrollments/[id]/actions.ts`**

Add at the end of the file (keep existing functions). Add the import at the top of the file with the other imports:

```ts
import { sendPaymentStatusEmail } from "@/lib/enrollments/email";
```

```ts
export async function updatePaymentStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const requestId = formData.get("requestId");
  if (typeof requestId !== "string" || !requestId)
    return { error: "Invalid request ID." };

  const newStatus = formData.get("paymentStatus");
  if (newStatus !== "PARTIALLY_PAID" && newStatus !== "FULLY_PAID") {
    return { error: "Please select a valid payment status." };
  }

  const session = await getSession();
  if (!session) return { error: "Unauthorized" };
  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")
    return { error: "Forbidden" };

  const request = await db.enrollmentRequest.findUnique({
    where: { id: requestId },
    select: {
      userId: true,
      courseId: true,
      firstName: true,
      email: true,
      course: { select: { title: true, tuitionFee: true } },
    },
  });
  if (!request?.userId)
    return { error: "Enrollment not found or not yet approved." };

  const enrollment = await db.enrollment.findFirst({
    where: { userId: request.userId, courseId: request.courseId },
    select: { id: true, totalPaid: true },
  });
  if (!enrollment) return { error: "Active enrollment not found." };

  try {
    await db.enrollment.update({
      where: { id: enrollment.id },
      data: { paymentStatus: newStatus },
    });
  } catch (err) {
    console.error("[updatePaymentStatus] DB error:", err);
    return { error: "A database error occurred. Please try again." };
  }

  revalidatePath("/admin/enrollments/" + requestId);

  try {
    await sendPaymentStatusEmail({
      to: request.email,
      firstName: request.firstName,
      courseName: request.course.title,
      paymentStatus: newStatus,
      totalPaid: enrollment.totalPaid.toNumber(),
      tuitionFee: request.course.tuitionFee?.toNumber() ?? null,
    });
  } catch (err) {
    console.error("[updatePaymentStatus] Email error:", err);
    return {
      error: "Status updated but email notification failed.",
      success: true,
    };
  }

  return { error: null, success: true };
}
```

- [ ] **Step 2: Create `app/(admin)/admin/enrollments/[id]/update-payment-status-form.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { updatePaymentStatusAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Props = {
  requestId: string;
  currentStatus: "PARTIALLY_PAID" | "FULLY_PAID";
};

export function UpdatePaymentStatusForm({ requestId, currentStatus }: Props) {
  const [state, formAction, isPending] = useActionState(
    updatePaymentStatusAction,
    { error: null },
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="requestId" value={requestId} />
      <div className="space-y-2">
        <Label htmlFor="paymentStatus">Payment Status</Label>
        <select
          id="paymentStatus"
          name="paymentStatus"
          defaultValue={currentStatus}
          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
        >
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="FULLY_PAID">Fully Paid</option>
        </select>
      </div>
      <Button
        type="submit"
        variant="outline"
        className="w-full"
        disabled={isPending}
      >
        {isPending ? "Updating..." : "Update Status"}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && !state.error && (
        <p className="text-sm text-green-600">Payment status updated.</p>
      )}
    </form>
  );
}
```

- [ ] **Step 3: Create `app/(admin)/admin/enrollments/[id]/payment-section.tsx`**

```tsx
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEnrollmentPaymentByRequest } from "@/lib/enrollments/queries";
import { UpdatePaymentStatusForm } from "./update-payment-status-form";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

type Props = { requestId: string; userId: string; courseId: string };

export async function PaymentSection({ requestId, userId, courseId }: Props) {
  const payment = await getEnrollmentPaymentByRequest(userId, courseId);
  if (!payment) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge
            className={
              payment.paymentStatus === "FULLY_PAID"
                ? "bg-green-100 text-green-800 border-green-200"
                : "bg-yellow-100 text-yellow-800 border-yellow-200"
            }
          >
            {payment.paymentStatus === "FULLY_PAID"
              ? "Fully Paid"
              : "Partially Paid"}
          </Badge>
          <span className="text-sm">
            <strong>₱{payment.totalPaid.toLocaleString("en-PH")}</strong>
            {payment.course.tuitionFee !== null && (
              <span className="text-muted-foreground">
                {" "}
                / ₱{payment.course.tuitionFee.toLocaleString("en-PH")}
              </span>
            )}
          </span>
        </div>

        {payment.paymentProofs.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Payment History</p>
            <div className="divide-y border rounded-md">
              {payment.paymentProofs.map((proof) => (
                <div key={proof.id} className="px-3 py-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">
                      ₱{proof.amount.toLocaleString("en-PH")}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {dateFormatter.format(proof.submittedAt)}
                    </span>
                  </div>
                  {proof.note && (
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {proof.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <UpdatePaymentStatusForm
          requestId={requestId}
          currentStatus={payment.paymentStatus}
        />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create `app/api/admin/payment-proof/[proofId]/route.ts`**

```ts
import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifySessionToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ proofId: string }> },
): Promise<NextResponse> {
  const { proofId } = await params;

  const token = req.cookies.get("session")?.value;
  const payload = token ? await verifySessionToken(token) : null;
  if (!payload)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const proof = await db.paymentProof.findUnique({
    where: { id: proofId },
    select: { proofUrl: true },
  });
  if (!proof) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabaseAdmin.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET!)
    .createSignedUrl(proof.proofUrl, 300);

  if (error)
    return NextResponse.json(
      { error: "Failed to generate signed URL" },
      { status: 500 },
    );

  return NextResponse.json({ signedUrl: data.signedUrl });
}
```

- [ ] **Step 5: Update admin enrollment detail page to show PaymentSection**

In `app/(admin)/admin/enrollments/[id]/page.tsx`, import `PaymentSection` and render it when the request is APPROVED and has a `userId`:

```tsx
import { PaymentSection } from "./payment-section";
```

In the JSX, after the Actions card:

```tsx
{
  !isPending && request.status === "APPROVED" && request.userId && (
    <PaymentSection
      requestId={id}
      userId={request.userId}
      courseId={request.courseId}
    />
  );
}
```

- [ ] **Step 7: Verify in browser**

Open an APPROVED enrollment in `/admin/enrollments/[id]`. Confirm the Payment card appears with the status badge, total paid, payment history, and the update status dropdown. Change the status and confirm the DB is updated.

- [ ] **Step 8: Commit**

```bash
git add lib/enrollments/email.ts "app/(admin)/admin/enrollments/[id]/actions.ts" "app/(admin)/admin/enrollments/[id]/payment-section.tsx" "app/(admin)/admin/enrollments/[id]/update-payment-status-form.tsx" "app/(admin)/admin/enrollments/[id]/page.tsx" "app/api/admin/payment-proof/[proofId]/route.ts"
git commit -m "feat: admin payment management — payment section, update status action, proof API"
```

---

## Task 8: Payment status email notifications

**Files:**

- Modify: `lib/enrollments/email.ts`

- [ ] **Step 1: Replace the stub in `lib/enrollments/email.ts` with the full `sendPaymentStatusEmail`**

Replace the stub added in Task 7 Step 1 with the full implementation:

```ts
export async function sendPaymentStatusEmail(params: {
  to: string;
  firstName: string;
  courseName: string;
  paymentStatus: "PARTIALLY_PAID" | "FULLY_PAID";
  totalPaid: number;
  tuitionFee: number | null;
}): Promise<void> {
  const { to, firstName, courseName, paymentStatus, totalPaid, tuitionFee } =
    params;
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/student/dashboard`;
  const totalPaidFormatted = `₱${totalPaid.toLocaleString("en-PH")}`;
  const tuitionFormatted =
    tuitionFee !== null ? `₱${tuitionFee.toLocaleString("en-PH")}` : null;

  const isFullyPaid = paymentStatus === "FULLY_PAID";
  const subject = isFullyPaid
    ? `Full Payment Confirmed — ${escapeHtml(courseName)}`
    : `Payment Recorded — ${escapeHtml(courseName)}`;

  const body = isFullyPaid
    ? `<p>Assalamualaykum ${escapeHtml(firstName)},</p>
<p>Congratulations! Your full payment for <strong>${escapeHtml(courseName)}</strong> has been confirmed.</p>
<p><strong>Total Paid:</strong> ${totalPaidFormatted}</p>
<p>You have full access to your course. You can view your payment history in your <a href="${dashboardUrl}">student dashboard</a>.</p>
<p>Best regards,<br>Al-Qur'an Academy Team</p>`
    : `<p>Assalamualaykum ${escapeHtml(firstName)},</p>
<p>Your payment for <strong>${escapeHtml(courseName)}</strong> has been recorded.</p>
<p><strong>Total Paid:</strong> ${totalPaidFormatted}${tuitionFormatted ? ` of ${tuitionFormatted}` : ""}</p>
<p>Please submit your remaining balance at your earliest convenience. You can upload additional proof of payment from your <a href="${dashboardUrl}">student dashboard</a>.</p>
<p>Best regards,<br>Al-Qur'an Academy Team</p>`;

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: `${subject} — Al-Qur'an Academy`,
    html: body,
  });
  if (error)
    throw new Error(`Failed to send payment status email: ${error.message}`);
}
```

- [ ] **Step 2: Verify `sendPaymentStatusEmail` is imported in `app/(admin)/admin/enrollments/[id]/actions.ts`**

Confirm this import exists (was added in Task 7):

```ts
import { sendPaymentStatusEmail } from "@/lib/enrollments/email";
```

- [ ] **Step 3: Test end-to-end**

1. Set a student's payment status to PARTIALLY_PAID via the admin page
2. Check Resend dashboard / email inbox for the "Payment Recorded" email
3. Set status to FULLY_PAID
4. Confirm "Full Payment Confirmed" email arrives

- [ ] **Step 4: Commit**

```bash
git add lib/enrollments/email.ts
git commit -m "feat: add payment status notification emails (partially paid / fully paid)"
```

---

## End-to-End Verification Checklist

- [ ] Student submits enrollment with "Partial Payment" + ₱5,000 → `EnrollmentRequest.paymentType=PARTIAL`, `amountPaid=5000`
- [ ] Student uploads proof → `EnrollmentRequest.paymentProofUrl` set
- [ ] Admin sees payment intent on enrollment detail
- [ ] Admin approves with "Partially Paid" → `Enrollment.paymentStatus=PARTIALLY_PAID`, `totalPaid=5000`, `PaymentProof` created
- [ ] Student logs into dashboard → sees "Partially Paid" badge, ₱5,000 / ₱10,000, history row, upload form
- [ ] Student submits additional ₱5,000 proof → new `PaymentProof`, `totalPaid=10000` in DB
- [ ] Admin opens APPROVED enrollment → Payment section shows 2 proof rows, update status form
- [ ] Admin sets to FULLY_PAID → `Enrollment.paymentStatus=FULLY_PAID`, email sent
- [ ] Student dashboard now shows "Fully Paid" badge, upload form is hidden
- [ ] Course tuition fee set in admin → shows on enrollment form and dashboard progress
