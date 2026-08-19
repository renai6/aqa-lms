"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

/**
 * Full-bleed campus film behind the hero, with the same darkening wash and
 * fade-to-white the still photo carried.
 *
 * The still stays on as the poster frame, so first paint looks exactly as it
 * did before the video decodes. The clip is decorative, hence aria-hidden and
 * muted - but it runs past five seconds, so WCAG 2.2.2 wants a way to stop it,
 * which is what the corner toggle is for. Reduced-motion visitors get the
 * poster held instead.
 */
export default function HeroBackdrop() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
    }
  }, []);

  function toggle() {
    const video = ref.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }

  return (
    <div className="absolute inset-0">
      <video
        ref={ref}
        src="/home/aqa-vision.mp4"
        poster="/aqa-bldg.png"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Darken for legibility, then fade out to the white page below */}
      <div className="bg-brand-maroon-deep/55 absolute inset-0" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.5)_0%,rgba(0,0,0,0.25)_45%,rgba(0,0,0,0.15)_74%,rgba(255,255,255,0.7)_94%,#ffffff_100%)]" />

      <button
        type="button"
        onClick={toggle}
        aria-label={
          playing ? "Pause the background video" : "Play the background video"
        }
        className="absolute right-5 bottom-28 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Play className="ml-0.5 h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
