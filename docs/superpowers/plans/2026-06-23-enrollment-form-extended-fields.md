# Enrollment Form Extended Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 required fields (gender, address, contact number, Facebook name, Facebook link, student type) to the enrollment form, enforce that new students must pay in full, and display the new fields on the admin enrollment detail page.

**Architecture:** Schema-first approach — migrate first so the Prisma client is regenerated before touching TypeScript. Update the query type and server action next so the form and admin page can rely on the correct types. Form and admin page are the final two independent UI steps.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 7, PostgreSQL, Zod 4, Tailwind CSS 4, shadcn/ui

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `StudentType` enum + 6 fields to `EnrollmentRequest` |
| `lib/enrollments/queries.ts` | Modify | Extend `EnrollmentRequestDetail` type + select in `getEnrollmentRequestById` |
| `lib/enrollments/actions.ts` | Modify | Extend Zod schema, add cross-field refinement, update `db.create` |
| `app/(public)/courses/[id]/enroll/enroll-form.tsx` | Modify | Add grouped sections, new fields, dynamic New/Old student logic |
| `app/(admin)/admin/enrollments/[id]/page.tsx` | Modify | Display 6 new fields in Applicant Information card |

---

## Task 1: Schema — Add StudentType enum and 6 fields to EnrollmentRequest

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the StudentType enum after the existing PaymentStatus enum**

In `prisma/schema.prisma`, locate the `PaymentStatus` enum (around line 69) and add immediately after:

```prisma
enum StudentType {
  NEW
  OLD
}
```

- [ ] **Step 2: Add 6 fields to the EnrollmentRequest model**

In `prisma/schema.prisma`, locate the `EnrollmentRequest` model. After `lastName String` (line ~131), add:

```prisma
  gender        Gender
  address       String
  contactNumber String
  facebookName  String
  facebookLink  String
  studentType   StudentType @default(NEW)
```

- [ ] **Step 3: Run the migration**

```bash
pnpm prisma migrate dev --name add-enrollment-extended-fields
```

Expected output ends with: `Your database is now in sync with your schema.`

- [ ] **Step 4: Verify the Prisma client was regenerated**

```bash
pnpm prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(schema): add StudentType enum and extended fields to EnrollmentRequest"
```

---

## Task 2: Queries — Extend EnrollmentRequestDetail type and select

**Files:**
- Modify: `lib/enrollments/queries.ts`

- [ ] **Step 1: Update the import to include the new types**

Replace the top import line:

```ts
import { EnrollmentStatus, Gender, PaymentStatus, PaymentType, StudentType } from '@prisma/client'
```

- [ ] **Step 2: Extend the EnrollmentRequestDetail type**

Replace the existing `EnrollmentRequestDetail` type (lines ~40-48):

```ts
export type EnrollmentRequestDetail = EnrollmentRequestRow & {
  courseId: string
  paymentProofUrl: string | null
  adminRemarks: string | null
  userId: string | null
  updatedAt: Date
  paymentType: PaymentType
  amountPaid: number
  gender: Gender
  address: string
  contactNumber: string
  facebookName: string
  facebookLink: string
  studentType: StudentType
}
```

- [ ] **Step 3: Add the 6 new fields to the select in getEnrollmentRequestById**

Inside the `select` object of `db.enrollmentRequest.findUnique` (after `amountPaid: true`), add:

```ts
      gender: true,
      address: true,
      contactNumber: true,
      facebookName: true,
      facebookLink: true,
      studentType: true,
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm build 2>&1 | head -30
```

Expected: no type errors in `lib/enrollments/queries.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/enrollments/queries.ts
git commit -m "feat(queries): extend EnrollmentRequestDetail with new enrollment fields"
```

---

## Task 3: Server Action — Extend Zod schema and db.create

**Files:**
- Modify: `lib/enrollments/actions.ts`

- [ ] **Step 1: Replace the enrollSchema with the extended version**

Replace the entire `enrollSchema` constant (lines ~13-20):

```ts
const enrollSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required.'),
    lastName: z.string().min(1, 'Last name is required.'),
    email: z.string().email('A valid email address is required.'),
    courseId: z.string().min(1, 'Course is required.'),
    gender: z.enum(['MALE', 'FEMALE'], { error: 'Gender is required.' }),
    address: z.string().min(1, 'Address is required.'),
    contactNumber: z.string().regex(
      /^(09\d{9}|\+639\d{9})$/,
      'Enter a valid PH mobile number (e.g. 09XXXXXXXXX).',
    ),
    facebookName: z.string().min(1, 'Facebook name is required.'),
    facebookLink: z.string().url('Enter a valid URL.'),
    studentType: z.enum(['NEW', 'OLD'], { error: 'Student type is required.' }),
    paymentType: z.enum(['PARTIAL', 'FULL']),
    amountPaid: z.coerce.number().positive('Amount paid must be greater than 0.'),
  })
  .refine((data) => !(data.studentType === 'NEW' && data.paymentType !== 'FULL'), {
    message: 'New students must pay in full.',
    path: ['paymentType'],
  })
```

- [ ] **Step 2: Update the raw object to include the 6 new fields**

Replace the entire `raw` object inside `submitEnrollmentAction` (lines ~27-34):

```ts
  const raw = {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    courseId: formData.get('courseId'),
    gender: formData.get('gender'),
    address: formData.get('address'),
    contactNumber: formData.get('contactNumber'),
    facebookName: formData.get('facebookName'),
    facebookLink: formData.get('facebookLink'),
    studentType: formData.get('studentType'),
    paymentType: formData.get('paymentType'),
    amountPaid: formData.get('amountPaid'),
  }
```

- [ ] **Step 3: Update the destructure and db.create call**

Replace the destructure line and `db.enrollmentRequest.create` call (lines ~40-58):

```ts
  const { firstName, lastName, email, courseId, gender, address, contactNumber, facebookName, facebookLink, studentType, paymentType, amountPaid } = result.data

  const course = await db.course.findFirst({
    where: { id: courseId, isPublished: true },
    select: { title: true },
  })
  if (!course) return { error: 'Course not found.' }

  const duplicate = await db.enrollmentRequest.findFirst({
    where: { email, courseId, status: { in: ['PENDING', 'APPROVED'] } },
  })
  if (duplicate) return { error: 'You have already applied for this course.' }

  let requestId: string
  try {
    const request = await db.enrollmentRequest.create({
      data: {
        firstName,
        lastName,
        email,
        courseId,
        gender,
        address,
        contactNumber,
        facebookName,
        facebookLink,
        studentType,
        paymentType,
        amountPaid,
      },
    })
    requestId = request.id
  } catch (err) {
    console.error('[submitEnrollment] DB error:', err)
    return { error: 'A database error occurred. Please try again.' }
  }
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm build 2>&1 | head -30
```

Expected: no type errors in `lib/enrollments/actions.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/enrollments/actions.ts
git commit -m "feat(actions): extend enrollment submission with new required fields and New Student payment rule"
```

---

## Task 4: Enrollment Form — Add grouped sections and new fields

**Files:**
- Modify: `app/(public)/courses/[id]/enroll/enroll-form.tsx`

- [ ] **Step 1: Replace the entire file with the updated form**

```tsx
'use client'

import { useState, useActionState } from 'react'
import { submitEnrollmentAction } from '@/lib/enrollments/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, Banknote, CreditCard, GraduationCap, BookOpen } from 'lucide-react'

type Props = { courseId: string; courseTitle: string; tuitionFee: number | null }

export function EnrollForm({ courseId, courseTitle, tuitionFee }: Props) {
  const [state, formAction, isPending] = useActionState(submitEnrollmentAction, { error: null })
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE')
  const [studentType, setStudentType] = useState<'NEW' | 'OLD'>('NEW')
  const [paymentType, setPaymentType] = useState<'FULL' | 'PARTIAL'>('FULL')

  function handleStudentTypeChange(type: 'NEW' | 'OLD') {
    setStudentType(type)
    if (type === 'NEW') setPaymentType('FULL')
  }

  const isNewStudent = studentType === 'NEW'

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="courseId" value={courseId} />

      {/* Course info strip */}
      <div className="rounded-xl border bg-card p-4">
        <p className="font-semibold text-foreground">{courseTitle}</p>
        {tuitionFee != null ? (
          <>
            <span className="text-lg font-bold text-foreground">
              ₱{tuitionFee.toLocaleString('en-PH')}
            </span>
            <p className="mt-0.5 text-xs text-muted-foreground">Flexible installments available</p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Contact us for pricing</p>
        )}
      </div>

      {/* ── Personal Information ── */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Personal Information
        </p>

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
          <Input id="email" name="email" type="email" required placeholder="juan@example.com" />
        </div>

        {/* Gender */}
        <div className="space-y-2">
          <Label>Gender</Label>
          <div className="flex gap-3">
            {(['MALE', 'FEMALE'] as const).map((g) => (
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
                    'rounded-xl border-2 p-4 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2',
                    gender === g ? 'border-primary bg-primary/5' : 'border-border bg-card',
                  ].join(' ')}
                >
                  <p className="text-sm font-semibold text-foreground">
                    {g === 'MALE' ? 'Male' : 'Female'}
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
            placeholder="House No., Street, Barangay, City, Province"
            rows={3}
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
          <Input id="facebookName" name="facebookName" required placeholder="Juan dela Cruz" />
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
      </div>

      {/* ── Payment ── */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Payment
        </p>

        {/* Student Type */}
        <div className="space-y-2">
          <Label>Student Type</Label>
          <div className="flex gap-3">
            <label className="flex-1 cursor-pointer">
              <input
                type="radio"
                name="studentType"
                value="NEW"
                checked={studentType === 'NEW'}
                onChange={() => handleStudentTypeChange('NEW')}
                className="peer sr-only"
              />
              <div
                className={[
                  'rounded-xl border-2 p-4 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2',
                  studentType === 'NEW' ? 'border-primary bg-primary/5' : 'border-border bg-card',
                ].join(' ')}
              >
                <GraduationCap className="mb-2 w-5 h-5 text-primary" />
                <p className="text-sm font-semibold text-foreground">New Student</p>
                <p className="mt-0.5 text-xs text-muted-foreground">First time enrolling</p>
              </div>
            </label>

            <label className="flex-1 cursor-pointer">
              <input
                type="radio"
                name="studentType"
                value="OLD"
                checked={studentType === 'OLD'}
                onChange={() => handleStudentTypeChange('OLD')}
                className="peer sr-only"
              />
              <div
                className={[
                  'rounded-xl border-2 p-4 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2',
                  studentType === 'OLD' ? 'border-primary bg-primary/5' : 'border-border bg-card',
                ].join(' ')}
              >
                <BookOpen className="mb-2 w-5 h-5 text-primary" />
                <p className="text-sm font-semibold text-foreground">Old Student</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Previously enrolled</p>
              </div>
            </label>
          </div>
        </div>

        {/* Payment Type */}
        <div className="space-y-2">
          <Label>Payment Type</Label>
          {isNewStudent ? (
            <>
              <input type="hidden" name="paymentType" value="FULL" />
              <div className="rounded-xl border-2 border-primary bg-primary/5 p-4">
                <Banknote className="mb-2 w-5 h-5 text-primary" />
                <p className="text-sm font-semibold text-foreground">Full Payment</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  New students are required to pay in full
                </p>
              </div>
            </>
          ) : (
            <div className="flex gap-3">
              <label className="flex-1 cursor-pointer">
                <input
                  type="radio"
                  name="paymentType"
                  value="FULL"
                  checked={paymentType === 'FULL'}
                  onChange={() => setPaymentType('FULL')}
                  className="peer sr-only"
                />
                <div
                  className={[
                    'rounded-xl border-2 p-4 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2',
                    paymentType === 'FULL'
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card',
                  ].join(' ')}
                >
                  <Banknote className="mb-2 w-5 h-5 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Full Payment</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Pay the full tuition upfront</p>
                </div>
              </label>

              <label className="flex-1 cursor-pointer">
                <input
                  type="radio"
                  name="paymentType"
                  value="PARTIAL"
                  checked={paymentType === 'PARTIAL'}
                  onChange={() => setPaymentType('PARTIAL')}
                  className="peer sr-only"
                />
                <div
                  className={[
                    'rounded-xl border-2 p-4 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2',
                    paymentType === 'PARTIAL'
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card',
                  ].join(' ')}
                >
                  <CreditCard className="mb-2 w-5 h-5 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Partial Payment</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Pay a portion now, rest later</p>
                </div>
              </label>
            </div>
          )}
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
      </div>

      {/* Error */}
      {state.error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          {state.error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? 'Submitting...' : 'Submit Application'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Start the dev server and test the form manually**

```bash
pnpm dev
```

Open `http://localhost:3000`, navigate to a published course, click Enroll.

Verify:
- All 8 new inputs are visible (gender, address, contact, facebook name, facebook link, student type, and the grouped layout)
- Selecting **New Student** hides the Partial Payment card and shows the locked Full Payment display
- Selecting **Old Student** restores the Full/Partial toggle
- Submitting with an invalid contact number (e.g. `12345`) shows the PH format error
- Submitting a valid form redirects to `/enroll/<id>`

- [ ] **Step 3: Commit**

```bash
git add app/\(public\)/courses/\[id\]/enroll/enroll-form.tsx
git commit -m "feat(enroll): add grouped form sections with extended personal and payment fields"
```

---

## Task 5: Admin Detail Page — Display new fields

**Files:**
- Modify: `app/(admin)/admin/enrollments/[id]/page.tsx`

- [ ] **Step 1: Add 6 new rows to the Applicant Information card**

In `app/(admin)/admin/enrollments/[id]/page.tsx`, locate the `CardContent` inside the Applicant Information card. After the existing `adminRemarks` block (around line 97), and before the closing `</CardContent>`, add the following rows. Insert them between the Email row and the Course row so the personal details are grouped:

Find the Email row block:
```tsx
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="text-sm text-muted-foreground w-32 shrink-0">Email</span>
                <span className="text-sm">{request.email}</span>
              </div>
```

After that block, add:
```tsx
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="text-sm text-muted-foreground w-32 shrink-0">Gender</span>
                <span className="text-sm">
                  {request.gender === 'MALE' ? 'Male' : 'Female'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                <span className="text-sm text-muted-foreground w-32 shrink-0">Address</span>
                <span className="text-sm">{request.address}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="text-sm text-muted-foreground w-32 shrink-0">Contact No.</span>
                <span className="text-sm">{request.contactNumber}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="text-sm text-muted-foreground w-32 shrink-0">Facebook Name</span>
                <span className="text-sm">{request.facebookName}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="text-sm text-muted-foreground w-32 shrink-0">Facebook Link</span>
                <a
                  href={request.facebookLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline-offset-4 hover:underline break-all"
                >
                  {request.facebookLink}
                </a>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="text-sm text-muted-foreground w-32 shrink-0">Student Type</span>
                <span className="text-sm">
                  {request.studentType === 'NEW' ? 'New Student' : 'Old Student'}
                </span>
              </div>
```

- [ ] **Step 2: Verify the build compiles clean**

```bash
pnpm build 2>&1 | head -40
```

Expected: no type errors. The `request` object now includes all new fields from Task 2's updated `EnrollmentRequestDetail` type.

- [ ] **Step 3: Verify the admin page renders the new fields**

With `pnpm dev` running, navigate to `/admin/enrollments/<id>` for a recently submitted enrollment request.

Verify all 6 new rows appear in the Applicant Information card: Gender, Address, Contact No., Facebook Name, Facebook Link (clickable), Student Type.

- [ ] **Step 4: Commit**

```bash
git add app/\(admin\)/admin/enrollments/\[id\]/page.tsx
git commit -m "feat(admin): display extended enrollment fields in applicant information card"
```
