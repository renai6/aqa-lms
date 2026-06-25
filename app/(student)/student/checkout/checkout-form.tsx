'use client'

import { useState, useActionState } from 'react'
import { createPurchaseAction } from '@/lib/purchases/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import type { CheckoutCourse } from '@/lib/purchases/queries'
import type { StudentType } from '@prisma/client'

type Props = { courses: CheckoutCourse[]; studentType: StudentType }

export function CheckoutForm({ courses, studentType }: Props) {
  const [state, formAction, isPending] = useActionState(createPurchaseAction, { error: null })
  const isNew = studentType === 'NEW'
  const [paymentType, setPaymentType] = useState<'FULL' | 'PARTIAL'>('FULL')
  const total = courses.reduce((s, c) => s + (c.tuitionFee ?? 0), 0)

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
              {c.tuitionFee != null ? `₱${c.tuitionFee.toLocaleString('en-PH')}` : '—'}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between p-4">
          <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Total</span>
          <span className="text-lg font-bold">₱{total.toLocaleString('en-PH')}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Payment Type</Label>
        {isNew ? (
          <>
            <input type="hidden" name="paymentType" value="FULL" />
            <div className="rounded-xl border-2 border-primary bg-primary/5 p-4 text-sm">
              <p className="font-semibold text-foreground">Full Payment</p>
              <p className="text-xs text-muted-foreground mt-0.5">New students are required to pay in full.</p>
            </div>
          </>
        ) : (
          <div className="flex gap-3">
            {(['FULL', 'PARTIAL'] as const).map((p) => (
              <label key={p} className="flex-1 cursor-pointer">
                <input type="radio" name="paymentType" value={p} checked={paymentType === p} onChange={() => setPaymentType(p)} className="peer sr-only" />
                <div className={['rounded-xl border-2 p-4 text-center transition-colors', paymentType === p ? 'border-primary bg-primary/5' : 'border-border bg-card'].join(' ')}>
                  <p className="text-sm font-semibold text-foreground">{p === 'FULL' ? 'Full Payment' : 'Partial Payment'}</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="amountPaid">Amount Paying Now (₱)</Label>
        <Input id="amountPaid" name="amountPaid" type="number" min="1" step="0.01" required placeholder="e.g. 5000" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="file">Proof of Payment</Label>
        <Input id="file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required />
        <p className="text-xs text-muted-foreground">JPG, PNG, or WEBP. Max 5MB.</p>
      </div>

      {state.error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {state.error}
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full h-11 font-semibold">
        {isPending ? 'Submitting…' : 'Submit purchase'}
      </Button>
    </form>
  )
}
