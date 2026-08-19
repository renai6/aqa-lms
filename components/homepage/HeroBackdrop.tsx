"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { Pause, Play } from "lucide-react";

/** Subscribes to a media query without mirroring it into state. */
function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    // The server cannot know the viewport, so it renders the still and the
    // video mounts on hydration where it belongs.
    () => false,
  );
}

/**
 * Hero backdrop: the campus film on desktop, the campus still on phones.
 *
 * The film is a 1290x640 strip and the hero is a full-height box, so a
 * portrait viewport would crop it to a narrow centre slice - roughly a
 * quarter of the frame - and upscale that. The still was composed for a tall
 * crop, so phones keep it. Gating on mount rather than in CSS also means a
 * phone never downloads the 4.2 MB.
 *
 * The still renders underneath either way, so it covers the moment before
 * the video decodes and is what reduced-motion visitors keep.
 */
export default function HeroBackdrop() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);

  const wideEnough = useMediaQuery("(min-width: 768px)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const showVideo = wideEnough && !reducedMotion;

  function toggle() {
    const video = ref.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }

  return (
    <div className="absolute inset-0">
      <Image
        src="/aqa-bldg.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />

      {showVideo && (
        <video
          ref={ref}
          src="/home/aqa-vision.mp4"
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
      )}

      {/* Darken for legibility, then fade out to the white page below */}
      <div className="bg-brand-maroon-deep/55 absolute inset-0" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.5)_0%,rgba(0,0,0,0.25)_45%,rgba(0,0,0,0.15)_74%,rgba(255,255,255,0.7)_94%,#ffffff_100%)]" />

      {/* An autoplaying loop past five seconds needs a way to stop it (WCAG 2.2.2). */}
      {showVideo && (
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
      )}
    </div>
  );
}
