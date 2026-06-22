'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

type Tab = 'admins' | 'teachers'
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
    <div className="flex gap-1 border-b border-border mb-6">
      {(['admins', 'teachers'] as const).map((tab) => (
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
          {tab === 'admins' ? 'Admins' : 'Teachers'}
        </button>
      ))}
    </div>
  )
}
