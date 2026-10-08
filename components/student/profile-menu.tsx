'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
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
// a parent can add their first kid from any device. A plain disclosure rather
// than an ARIA menu: its items are ordinary buttons and a link, reached by Tab.
export function ProfileMenu({ self, kids, activeKidId, canManageKids }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const active = kids.find((k) => k.id === activeKidId)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
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
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10"
      >
        <span className="max-w-32 truncate">{active?.firstName ?? self.firstName}</span>
        <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
      </button>
      {open && (
        <div id={panelId} className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border bg-white py-1 text-sm shadow-lg">
          <p className="text-muted-foreground px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide uppercase">Studying as</p>
          {profiles.map((p) => {
            const current = (p.id || null) === activeKidId
            return (
              <form key={p.id || 'self'} action={switchProfileAction}>
                <input type="hidden" name="kidId" value={p.id} />
                <SwitchButton current={current} onSettled={() => setOpen(false)}>
                  <span className="truncate">{p.id ? p.firstName : `${p.firstName} (me)`}</span>
                </SwitchButton>
              </form>
            )
          })}
          {canManageKids && (
            <>
              <div className="my-1 border-t" />
              <Link href="/student/kids" onClick={() => setOpen(false)} className="hover:bg-muted block px-3 py-2">
                Manage kids
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// A child of the form, so useFormStatus sees that form's submission. The menu
// stays open while the switch runs, so the pending label is visible, and closes
// once it settles rather than being left open after the redirect.
function SwitchButton({ current, onSettled, children }: { current: boolean; onSettled: () => void; children: ReactNode }) {
  const { pending } = useFormStatus()
  const wasPending = useRef(false)
  useEffect(() => {
    if (wasPending.current && !pending) onSettled()
    wasPending.current = pending
  }, [pending, onSettled])

  return (
    <button
      type="submit"
      disabled={pending}
      aria-current={current ? 'true' : undefined}
      className="hover:bg-muted flex w-full items-center justify-between gap-2 px-3 py-2 text-left disabled:opacity-60"
    >
      {children}
      {pending ? (
        <span className="text-muted-foreground text-xs">Switching...</span>
      ) : (
        current && <span className="text-primary text-xs font-medium">Current</span>
      )}
    </button>
  )
}
