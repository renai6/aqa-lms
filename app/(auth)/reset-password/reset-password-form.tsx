'use client'

import { useActionState } from 'react'
import { resetPasswordAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, isPending] = useActionState(resetPasswordAction, { error: null })

  if (!token) {
    return (
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">This reset link is invalid.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Set new password</CardTitle>
        <CardDescription>Enter and confirm your new password.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <div className="space-y-1">
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" required minLength={8} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" name="confirm" type="password" required minLength={8} />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Saving…' : 'Set new password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
