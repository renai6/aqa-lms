'use client'

import { useActionState } from 'react'
import { submitEnrollmentAction } from '@/lib/enrollments/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = { courseId: string; courseTitle: string; tuitionFee: number | null }

export function EnrollForm({ courseId, courseTitle, tuitionFee }: Props) {
  const [state, formAction, isPending] = useActionState(submitEnrollmentAction, { error: null })

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <div className="p-3 bg-muted rounded-md text-sm">
        <span className="text-muted-foreground">Enrolling in: </span>
        <strong>{courseTitle}</strong>
      </div>
      {tuitionFee !== null && (
        <p className="text-sm text-muted-foreground">
          Total tuition fee: <strong>₱{tuitionFee.toLocaleString('en-PH')}</strong>
        </p>
      )}
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
      <div className="space-y-2">
        <Label>Payment Type</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="paymentType" value="FULL" defaultChecked className="accent-primary" />
            <span className="text-sm">Full Payment</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="paymentType" value="PARTIAL" className="accent-primary" />
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
        {isPending ? 'Submitting...' : 'Submit Application'}
      </Button>
    </form>
  )
}
