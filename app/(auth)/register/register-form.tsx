'use client'

import { useState, useActionState } from 'react'
import Link from 'next/link'
import { registerAction } from './actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(registerAction, { error: null })
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE')
  const [studentType, setStudentType] = useState<'NEW' | 'OLD'>('NEW')

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input id="firstName" name="firstName" required placeholder="Juan" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input id="lastName" name="lastName" required placeholder="dela Cruz" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input id="email" name="email" type="email" required placeholder="juan@example.com" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required autoComplete="new-password" placeholder="••••••••" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" placeholder="••••••••" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Gender</Label>
        <div className="flex gap-3">
          {(['MALE', 'FEMALE'] as const).map((g) => (
            <label key={g} className="flex-1 cursor-pointer">
              <input type="radio" name="gender" value={g} checked={gender === g} onChange={() => setGender(g)} className="peer sr-only" />
              <div className={['rounded-xl border-2 p-3 text-center transition-colors', gender === g ? 'border-primary bg-primary/5' : 'border-border bg-card'].join(' ')}>
                <p className="text-sm font-semibold text-foreground">{g === 'MALE' ? 'Male' : 'Female'}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" name="address" required rows={2} placeholder="House No., Street, Barangay, City, Province" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contactNumber">Contact Number</Label>
        <Input id="contactNumber" name="contactNumber" type="tel" required placeholder="09XXXXXXXXX" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="facebookName">Facebook Name</Label>
        <Input id="facebookName" name="facebookName" required placeholder="Juan dela Cruz" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="facebookLink">Facebook Link</Label>
        <Input id="facebookLink" name="facebookLink" type="url" required placeholder="https://facebook.com/yourprofile" />
      </div>

      <div className="space-y-2">
        <Label>Student Type</Label>
        <div className="flex gap-3">
          {(['NEW', 'OLD'] as const).map((t) => (
            <label key={t} className="flex-1 cursor-pointer">
              <input type="radio" name="studentType" value={t} checked={studentType === t} onChange={() => setStudentType(t)} className="peer sr-only" />
              <div className={['rounded-xl border-2 p-3 text-center transition-colors', studentType === t ? 'border-primary bg-primary/5' : 'border-border bg-card'].join(' ')}>
                <p className="text-sm font-semibold text-foreground">{t === 'NEW' ? 'New Student' : 'Old Student'}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {state.error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {state.error}
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full h-11 font-semibold">
        {isPending ? 'Creating account…' : 'Create account'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium" style={{ color: 'oklch(0.525 0.223 3.958)' }}>
          Sign in
        </Link>
      </p>
    </form>
  )
}
