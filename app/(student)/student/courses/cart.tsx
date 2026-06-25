'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { PurchasableCourse } from '@/lib/purchases/queries'

export function CourseCart({ courses }: { courses: PurchasableCourse[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const total = courses
    .filter((c) => selected.has(c.id))
    .reduce((sum, c) => sum + (c.tuitionFee ?? 0), 0)

  function checkout() {
    const ids = [...selected]
    if (ids.length === 0) return
    router.push(`/student/checkout?ids=${ids.join(',')}`)
  }

  if (courses.length === 0) {
    return <p className="text-sm text-muted-foreground">No courses available to purchase right now.</p>
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {courses.map((c) => {
          const isSel = selected.has(c.id)
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              aria-pressed={isSel}
              className={[
                'text-left rounded-xl border-2 p-4 transition-colors',
                isSel ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40',
              ].join(' ')}
            >
              <p className="font-semibold text-foreground">{c.title}</p>
              {c.description && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
              )}
              <p className="mt-2 text-sm font-bold text-foreground">
                {c.tuitionFee != null ? `₱${c.tuitionFee.toLocaleString('en-PH')}` : 'Contact us for pricing'}
              </p>
            </button>
          )
        })}
      </div>

      <div className="sticky bottom-0 flex items-center justify-between rounded-xl border bg-card p-4">
        <div>
          <p className="text-xs text-muted-foreground">{selected.size} selected</p>
          <p className="text-lg font-bold">₱{total.toLocaleString('en-PH')}</p>
        </div>
        <Button onClick={checkout} disabled={selected.size === 0}>
          Proceed to checkout
        </Button>
      </div>
    </div>
  )
}
