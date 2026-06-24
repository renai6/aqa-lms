'use client'

import { signOutAction } from '@/lib/auth/sign-out'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" size="sm">
        Sign Out
      </Button>
    </form>
  )
}
