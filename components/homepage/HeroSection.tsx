import Image from "next/image";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_25%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.12),transparent_22%),linear-gradient(180deg,#020617,#080c17)]" />
      <div className="absolute -left-16 top-24 h-60 w-60 rounded-full bg-sky-500/15 blur-3xl" />
      <div className="absolute left-1/4 bottom-24 h-44 w-44 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
        <Image
          src="/aqa-bldg.png"
          alt="AQA building"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
      </div>

      {/* SVG grain texture */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full opacity-[0.04] pointer-events-none mix-blend-overlay"
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>

      {/* Main content */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-6 sm:px-10 lg:px-16 pt-24 pb-20">
        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white leading-tight tracking-tight max-w-3xl">
          Experience a{" "}
          <span className="highlight-crimson">credible, high-quality</span>{" "}
          <span className="highlight-crimson">Islamic education</span> built for
          busy lives
        </h1>

        <p className="mt-6 text-base sm:text-lg text-white/80 italic">
          Guided by the Saudi Ministry curriculum &amp; Ivy League standard
        </p>

        <p className="mt-4 text-sm text-white/70 max-w-lg leading-relaxed">
          Al-Qur&apos;an Academy (AQA) features{" "}
          <strong className="text-white font-semibold">
            online &amp; face-to-face programs
          </strong>{" "}
          for secular students, working adults, kids, and even reverts &amp;
          seniors.
        </p>

        <div className="mt-8 flex flex-wrap gap-4 items-center">
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-widest transition-opacity hover:opacity-90"
          >
            Explore Programs <ArrowUpRight className="w-4 h-4" />
          </Link>
          {/* <Link
            href="/community"
            className="inline-flex items-center gap-2 border border-white/30 text-white rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-widest transition-colors hover:bg-white/10"
          >
            Join AQA Community
          </Link> */}
        </div>

        <p className="mt-8 text-xs text-white/40">
          SEC Reg. No. 2023020084187-00
        </p>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <ChevronDown className="w-6 h-6 text-white/50 animate-bounce" />
      </div>
    </section>
  );
}
