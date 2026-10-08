'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { switchProfileAction } from '@/lib/students/dependent-actions'

type Props = {
  self: { firstName: string }
  kids: { id: string; firstName: string }[]
  activeKidId: string | null
  // False for a linked kid: kids cannot have kids.
  canManageKids: boolean
}

// Always visible, including on mobile where the other nav links are hidden, so
// a parent can add their first kid from any device.
export function ProfileMenu({ self, kids, activeKidId, canManageKids }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = kids.find((k) => k.id === activeKidId)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const profiles = [{ id: '', firstName: self.firstName }, ...kids]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10"
      >
        <span className="max-w-32 truncate">{active?.firstName ?? self.firstName}</span>
        <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border bg-white py-1 text-sm shadow-lg">
          <p className="text-muted-foreground px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide uppercase">Studying as</p>
          {profiles.map((p) => {
            const selected = (p.id || null) === activeKidId
            return (
              <form key={p.id || 'self'} action={switchProfileAction}>
                <input type="hidden" name="kidId" value={p.id} />
                <button
                  type="submit"
                  role="menuitemradio"
                  aria-checked={selected}
                  className="hover:bg-muted flex w-full items-center justify-between px-3 py-2 text-left"
                >
                  <span className="truncate">{p.id ? p.firstName : `${p.firstName} (me)`}</span>
                  {selected && <span className="text-primary text-xs font-medium">Current</span>}
                </button>
              </form>
            )
          })}
          {canManageKids && (
            <>
              <div className="my-1 border-t" />
              <Link href="/student/kids" role="menuitem" onClick={() => setOpen(false)} className="hover:bg-muted block px-3 py-2">
                Manage kids
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}
