'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type NavLinkProps = {
  href: string
  icon: React.ReactNode
  label: string
  disabled?: boolean
}

export function NavLink({ href, icon, label, disabled }: NavLinkProps) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')

  const baseClasses = 'flex items-center gap-3 px-4 py-2 rounded-lg transition-colors'

  if (disabled) {
    return (
      <span
        className={cn(
          baseClasses,
          'text-muted-foreground cursor-not-allowed opacity-50'
        )}
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
        baseClasses,
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  )
}
