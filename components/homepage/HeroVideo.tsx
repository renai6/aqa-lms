"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import Reveal from "./Reveal";

/**
 * Wide banner film that sits between the hero and the affiliations strip,
 * mirroring where it falls on the AQA Envisioned 2027 site.
 *
 * The clip is decorative and silent, so it loops muted. It runs past five
 * seconds though, which means WCAG 2.2.2 requires a way to stop it - hence
 * the corner toggle. Visitors who ask for reduced motion get it held on the
 * first frame instead, and start it themselves if they want it.
 */
export default function HeroVideo() {
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
    <section className="bg-white px-6 pt-4 pb-10">
      <Reveal className="mx-auto max-w-6xl">
        <div className="bg-brand-maroon-deep relative overflow-hidden rounded-[20px] shadow-[0_14px_40px_rgba(0,0,0,0.22)]">
          <video
            ref={ref}
            src="/home/aqa-vision.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-label="Al-Qur'an Academy campus and classes"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            className="aspect-[1290/640] w-full object-cover"
          />

          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pause the video" : "Play the video"}
            className="bg-brand-maroon-deep/70 hover:bg-brand-maroon absolute right-4 bottom-4 flex h-10 w-10 items-center justify-center rounded-full text-white backdrop-blur-sm transition-colors"
          >
            {playing ? (
              <Pause className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="ml-0.5 h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </Reveal>
    </section>
  );
}
