"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

/** AQA Faculty Board portraits, from /public/faculty. */
const FACULTY = [
  "shaykh vlad.png",
  "shaykh abuhafs.png",
  "shaykh ahmad.png",
  "shaykh abu furqan.png",
  "shaykh ahmed.png",
  "shaykh bash.png",
  "shaykh hafeyz.png",
  "shaykh jibrin.png",
  "shaykh nadhir.png",
  "shaykh raffy.png",
  "shaykh shater.png",
  "shk alsam.png",
  "ustadha mozifa.png",
  "ustadha shaiwra.png",
];

const PER_PAGE = 3;
const INTERVAL_MS = 3500;
const TILT = [-4, 0, 4];

export default function FacultyCarousel() {
  const pages = useMemo(() => {
    const out: string[][] = [];
    for (let i = 0; i < FACULTY.length; i += PER_PAGE) {
      const group = FACULTY.slice(i, i + PER_PAGE);
      // The roster does not divide evenly into pages, so wrap back to the
      // start rather than leave the last page short.
      while (group.length < PER_PAGE) {
        group.push(FACULTY[group.length % FACULTY.length]);
      }
      out.push(group);
    }
    return out;
  }, []);

  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(
      () => setPage((p) => (p + 1) % pages.length),
      INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [paused, pages.length]);

  return (
    <div
      className="relative h-full overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="group"
      aria-roledescription="carousel"
      aria-label="AQA Faculty Board"
    >
      <div
        className="flex h-full transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${page * 100}%)` }}
      >
        {pages.map((group, gi) => (
          <div
            key={gi}
            className="flex h-full w-full shrink-0 items-end justify-center gap-1.5 px-3"
            aria-hidden={gi !== page}
          >
            {group.map((name, i) => (
              <div
                key={`${name}-${i}`}
                className={[
                  // The portraits are transparent cut-outs, so each sits on
                  // its own amber tile the way the reference does.
                  "bg-brand-amber relative w-[100px] shrink-0 overflow-hidden rounded-[10px]",
                  i === 1 ? "h-[156px]" : "h-[134px]",
                ].join(" ")}
                style={{ transform: `rotate(${TILT[i] ?? 0}deg)` }}
              >
                <Image
                  src={`/faculty/${name}`}
                  alt=""
                  fill
                  sizes="120px"
                  className="object-contain object-bottom"
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Sits just above the tallest tile so it reads as part of the strip. */}
      <div className="absolute inset-x-0 bottom-[168px] flex justify-center gap-1.5">
        {pages.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setPage(i)}
            aria-label={`Show faculty ${i + 1} of ${pages.length}`}
            aria-current={i === page}
            className={[
              "h-1.5 rounded-full transition-all",
              i === page
                ? "bg-brand-maroon w-5"
                : "bg-brand-maroon/30 hover:bg-brand-maroon/60 w-1.5",
            ].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}
