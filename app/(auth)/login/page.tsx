'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { loginAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'

export default function LoginPage() {
  const [state, action, isPending] = useActionState(loginAction, { error: null })

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Enter your credentials to access AQA LMS.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/forgot-password" className="underline underline-offset-4">
              Forgot password?
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
