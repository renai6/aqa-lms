"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import Reveal from "@/components/homepage/Reveal";

/**
 * The "Meet AQA Instructors" poster set from /public/faculty/fca.
 *
 * `names` is not rendered as body copy - the poster art already carries it -
 * but it supplies the alt text, so the roster is readable to search engines
 * and screen readers that cannot see into the artwork.
 */
const POSTERS = [
  { src: "/faculty/fca/1.png", names: ["Shaykh Vladimir Sahiron (President)", "Shaykh Ahmad Bayan (Director)"] },
  { src: "/faculty/fca/2.png", names: ["Shaykh Randy Evangelista (Co-Founder)", "Shaykh Ahmed Abtahi"] },
  { src: "/faculty/fca/3.png", names: ["Shaykh Alsam Adjilul", "Shaykh Abdulgani Arabain"] },
  { src: "/faculty/fca/4.png", names: ["Shaykh Muhammad Basheer Bayan", "Shaykh Hafeyz Bautista"] },
  { src: "/faculty/fca/5.png", names: ["Shaykh Al-Midzbar Bunajal", "Shaykh Abu Hafs Mujahid"] },
  { src: "/faculty/fca/6.png", names: ["Shaykh Nadhir Oquendo", "Shaykh Shater Salih"] },
  { src: "/faculty/fca/7.png", names: ["Shaykh Dr. Jibrin Talani"] },
  { src: "/faculty/fca/8.png", names: ["Ustadha Asma Sapantun", "Ustadha Rashiada Mohammad Ain"] },
];

/** Alt text for a poster: the credentials belong to the people it shows. */
function altFor(names: string[]) {
  return `Faculty profile: ${names.join(" and ")}`;
}

export default function FacultyPosters() {
  /** Index of the poster shown full-screen, or null when the viewer is closed. */
  const [open, setOpen] = useState<number | null>(null);

  const step = useCallback((delta: number) => {
    setOpen((i) => (i === null ? i : (i + delta + POSTERS.length) % POSTERS.length));
  }, []);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    // The viewer covers the page, so the body behind it must not scroll.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, step]);

  return (
    <>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {POSTERS.map((poster, i) => (
          <Reveal key={poster.src} delay={(i % 2) * 90}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`Enlarge ${altFor(poster.names)}`}
              className="group focus-visible:ring-brand-maroon relative block w-full cursor-zoom-in overflow-hidden rounded-[20px] bg-[#f7f7f7] ring-offset-2 focus-visible:ring-2 focus-visible:outline-none"
            >
              <Image
                src={poster.src}
                alt={altFor(poster.names)}
                width={3375}
                height={3375}
                sizes="(max-width: 768px) 100vw, 560px"
                priority={i < 2}
                className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transform-none motion-reduce:transition-none"
              />

              {/* Affordance for the zoom, revealed on hover and on keyboard focus. */}
              <span className="text-brand-maroon-dark pointer-events-none absolute right-4 bottom-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-4 py-2 text-xs font-medium opacity-0 shadow-sm transition-opacity duration-300 group-focus-visible:opacity-100 group-hover:opacity-100 motion-reduce:transition-none">
                <ZoomIn className="h-3.5 w-3.5" /> View full size
              </span>
            </button>
          </Reveal>
        ))}
      </div>

      {open !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={altFor(POSTERS[open].names)}
          onClick={() => setOpen(null)}
          className="bg-brand-maroon-deep/95 fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm sm:p-8"
        >
          <button
            type="button"
            onClick={() => setOpen(null)}
            aria-label="Close"
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/25 sm:top-6 sm:right-6"
          >
            <X className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            aria-label="Previous faculty poster"
            className="absolute left-2 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/25 sm:left-6"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            aria-label="Next faculty poster"
            className="absolute right-2 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/25 sm:right-6"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          {/* Square art, so bounding it by the shorter viewport axis keeps the
              whole poster on screen without letterboxing it. */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative aspect-square w-full max-w-[min(92vw,88vh)] overflow-hidden rounded-2xl bg-white"
          >
            <Image
              src={POSTERS[open].src}
              alt={altFor(POSTERS[open].names)}
              fill
              sizes="(max-width: 640px) 92vw, 88vh"
              className="object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
