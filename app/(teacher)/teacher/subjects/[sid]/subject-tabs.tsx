'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

// URL-driven tabs for a subject's sections, mirroring the admin tab-switcher
// look (bottom-border active state).
export function SubjectTabs({ subjectId }: { subjectId: string }) {
  const pathname = usePathname()
  const base = '/teacher/subjects/' + subjectId
  const tabs = [
    { href: base, label: 'Assessments' },
    { href: base + '/students', label: 'Students' },
    { href: base + '/grades', label: 'Grades' },
  ]

  return (
    <div className="flex gap-6 border-b">
      {tabs.map((t) => {
        const isActive =
          t.href === base ? pathname === base : pathname.startsWith(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              '-mb-px border-b-2 pb-2 text-sm transition-colors',
              isActive
                ? 'border-primary text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
