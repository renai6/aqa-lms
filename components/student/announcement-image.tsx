'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { X, ZoomIn } from 'lucide-react'

type Props = { src: string; title: string; variant: 'compact' | 'full' }

// An announcement image that opens full size on click, in the same viewer
// style as the faculty posters. The dashboard card shows a cover crop and the
// announcements page a card-width image, so this is the one place a student
// is guaranteed to see the whole image.
export function AnnouncementImage({ src, title, variant }: Props) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    // The viewer covers the page, so the body behind it must not scroll.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
      trigger?.focus()
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Enlarge image: ${title}`}
        className={`group focus-visible:ring-primary relative block w-full cursor-zoom-in focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset ${
          variant === 'compact' ? 'bg-muted aspect-[16/10] overflow-hidden' : ''
        }`}
      >
        {variant === 'compact' ? (
          // A fixed-ratio cover keeps every dashboard card the same shape.
          // Anchored to the top because announcement images are often
          // documents whose heading is the part worth seeing.
          <Image
            src={src}
            alt={title}
            fill
            sizes="(min-width: 1024px) 33vw, 100vw"
            className="object-cover object-top"
          />
        ) : (
          <Image
            src={src}
            alt={title}
            width={1200}
            height={800}
            sizes="(min-width: 768px) 672px, 100vw"
            className="h-auto w-full"
          />
        )}
        {/* Affordance for the zoom, revealed on hover and on keyboard focus. */}
        <span className="text-primary pointer-events-none absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium opacity-0 shadow-sm transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
          <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" /> View full size
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={() => setOpen(false)}
          className="bg-brand-maroon-deep/95 fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm sm:p-8"
        >
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none sm:top-6 sm:right-6"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Announcement images come in any shape, so the image keeps its own
              aspect ratio and is only capped to the viewport, never cropped. */}
          <Image
            src={src}
            alt={title}
            width={1200}
            height={800}
            sizes="92vw"
            onClick={(e) => e.stopPropagation()}
            className="h-auto max-h-[88vh] w-auto max-w-[92vw] rounded-2xl bg-white object-contain"
          />
        </div>
      )}
    </>
  )
}
