'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { forgotPasswordAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'

export default function ForgotPasswordPage() {
  const [state, action, isPending] = useActionState(forgotPasswordAction, { submitted: false })

  if (state.submitted) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            If an account exists for that email, a reset link has been sent.
          </p>
          <p className="mt-4 text-center text-sm">
            <Link href="/login" className="underline underline-offset-4">Back to sign in</Link>
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Forgot password</CardTitle>
        <CardDescription>Enter your email to receive a reset link.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Sending…' : 'Send reset link'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="underline underline-offset-4">Back to sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
