'use client'

import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type NavLinkProps = {
  href: string
  icon: React.ReactNode
  label: string
  disabled?: boolean
}

// useLinkStatus reports on the nearest <Link> ancestor, so this has to render
// inside the link it belongs to. It closes the gap between the click and the
// route's loading.tsx appearing, which is where a slow page feels frozen.
function NavSpinner() {
  const { pending } = useLinkStatus()
  if (!pending) return null

  return (
    <LoaderCircle
      className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin"
      aria-hidden="true"
    />
  )
}

export function NavLink({ href, icon, label, disabled }: NavLinkProps) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')

  const base = 'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors'

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        title="Coming soon"
        className={cn(base, 'border-l-2 border-transparent pl-[10px] text-sidebar-foreground/30 cursor-not-allowed')}
      >
        {icon}
        <span>{label}</span>
      </span>
    )
  }

  return (
    <Link
      href={href}
      className={cn(
        base,
        isActive
          ? 'border-l-2 border-primary bg-sidebar-accent text-sidebar-accent-foreground font-medium pl-[10px]'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border-l-2 border-transparent pl-[10px]'
      )}
    >
      {icon}
      <span>{label}</span>
      <NavSpinner />
    </Link>
  )
}
