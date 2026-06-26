import Link from 'next/link'
import Image from 'next/image'
import { SignOutButton } from './sign-out-button'

type Props = { firstName: string }

export function StudentNav({ firstName }: Props) {
  return (
    <header className="sticky top-0 z-10 bg-zinc-900 border-b border-white/8">
      <div className="px-6 md:px-10 h-16 flex items-center justify-between">
        <Link href="/student/dashboard" className="flex items-center gap-3">
          <Image src="/aqa-logo.png" alt="Al-Qur'an Academy" width={44} height={44} className="h-10 w-10 rounded-full object-cover shrink-0" />
          <div className="hidden sm:block leading-none">
            <p className="text-white text-xs font-semibold tracking-wide">AL-QUR&apos;AN ACADEMY</p>
            <p className="text-white/50 text-[10px] tracking-widest mt-0.5">INTERNATIONAL</p>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <Link href="/student/dashboard" className="text-white/70 hover:text-white text-sm hidden sm:block">Dashboard</Link>
          <Link href="/student/courses" className="text-white/70 hover:text-white text-sm hidden sm:block">Courses</Link>
          <span className="text-white/40 text-xs hidden sm:block">{firstName}</span>
          <SignOutButton className="text-white/60 hover:text-white hover:bg-white/10" />
        </div>
      </div>
    </header>
  )
}
