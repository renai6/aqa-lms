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
