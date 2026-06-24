// app/(student)/student/courses/[id]/subjects/[sid]/tab-switcher.tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

type Tab = 'lessons' | 'assessments'
type Props = { activeTab: Tab }

export function TabSwitcher({ activeTab }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function switchTab(tab: Tab) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.push('?' + params.toString())
  }

  return (
    <div className="flex gap-1 border-b border-border">
      {(['lessons', 'assessments'] as const).map(tab => (
        <button
          key={tab}
          onClick={() => switchTab(tab)}
          className={cn(
            'px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
            activeTab === tab
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      ))}
    </div>
  )
}
