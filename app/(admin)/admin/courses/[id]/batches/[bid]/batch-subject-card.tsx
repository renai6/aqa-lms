'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

type Props = {
  title: string
  children: ReactNode
}

export function BatchSubjectCard({ title, children }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Card>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className={[
          'group flex w-full items-center justify-between gap-3 p-6 text-left',
          isOpen ? 'pb-2' : '',
        ].join(' ')}
      >
        <h2 className="text-base font-semibold leading-none tracking-tight">{title}</h2>
        <ChevronDown
          className={[
            'w-4 h-4 shrink-0 text-muted-foreground transition-transform group-hover:text-foreground',
            isOpen ? 'rotate-180' : '',
          ].join(' ')}
          aria-hidden="true"
        />
      </button>
      <CardContent hidden={!isOpen}>{children}</CardContent>
    </Card>
  )
}
