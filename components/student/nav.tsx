import Link from 'next/link'
import { SignOutButton } from './sign-out-button'

type Props = { firstName: string }

export function StudentNav({ firstName }: Props) {
  return (
    <header className="border-b bg-background sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/student/dashboard" className="font-semibold text-sm">
          Al-Qur&apos;an Academy
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">{firstName}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
