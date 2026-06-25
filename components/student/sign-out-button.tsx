'use client'

import { signOutAction } from '@/lib/auth/sign-out'
import { Button } from '@/components/ui/button'

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" size="sm" className={className}>
        Sign Out
      </Button>
    </form>
  )
}
