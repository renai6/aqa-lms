import Link from 'next/link'
import { SignOutButton } from './sign-out-button'

type Props = { firstName: string }

export function StudentNav({ firstName }: Props) {
  return (
    <header className="sticky top-0 z-10 bg-zinc-900 border-b border-white/8">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/student/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full border-2 border-primary flex items-center justify-center shrink-0">
            <span className="text-primary font-bold text-[10px] tracking-tight">AQA</span>
          </div>
          <div className="hidden sm:block leading-none">
            <p className="text-white text-xs font-semibold tracking-wide">AL-QUR&apos;AN ACADEMY</p>
            <p className="text-white/50 text-[10px] tracking-widest mt-0.5">INTERNATIONAL</p>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <span className="text-white/40 text-xs hidden sm:block">{firstName}</span>
          <SignOutButton className="text-white/60 hover:text-white hover:bg-white/10" />
        </div>
      </div>
    </header>
  )
}
