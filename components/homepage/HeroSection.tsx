import Image from "next/image";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import GeoMotif from "./GeoMotif";

export default function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden bg-black">
      {/* Base wash + depth */}
      <div className="absolute inset-0 bg-[linear-gradient(140deg,#0b0b0f_0%,#070709_45%,#000000_100%)]" />
      <div className="absolute -top-40 -right-24 h-[800px] w-[800px] rounded-full bg-[radial-gradient(circle,rgba(236,204,105,0.12),transparent_65%)]" />

      {/* Fine grid lines */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(rgba(236,204,105,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(236,204,105,0.05) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Geometric motif */}
      <GeoMotif className="-top-20 -right-20" />

      {/* Building image, right half */}
      <div className="absolute inset-y-0 right-0 hidden w-1/2 overflow-hidden lg:block">
        <Image
          src="/aqa-bldg.png"
          alt="AQA building"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
      </div>

      {/* Left vignette for text legibility */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_20%_50%,transparent_40%,rgba(0,0,0,0.6)_100%)]" />

      {/* Main content */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-24 pb-24 sm:px-10 lg:px-16">
        <div className="max-w-3xl">
          <div className="mb-8 flex animate-[fadeUp_0.9s_0.1s_both] items-center gap-2.5">
            <span className="bg-gold h-1.5 w-1.5 rounded-full" />
            <span className="text-gold text-[10px] font-semibold tracking-[0.3em] uppercase">
              Online &amp; Face-to-Face Programs
            </span>
            <span className="bg-gold/40 h-px w-14" />
          </div>

          <h1 className="animate-[fadeUp_0.9s_0.2s_both] text-4xl leading-[1.05] font-semibold tracking-tight text-white sm:text-5xl lg:text-[4.2rem]">
            Experience a{" "}
            <span className="text-gold font-normal">
              credible, high-quality
            </span>{" "}
            <span className="text-gold font-normal">Islamic education</span>{" "}
            built for busy lives
          </h1>

          <p className="mt-6 animate-[fadeUp_0.9s_0.32s_both] text-base text-white/60 italic sm:text-lg">
            Guided by the Saudi Ministry curriculum &amp; Ivy League standard
          </p>

          <p className="mt-5 max-w-lg animate-[fadeUp_0.9s_0.42s_both] text-sm leading-relaxed font-light text-white/70">
            Al-Qur&apos;an Academy (AQA) features{" "}
            <strong className="font-semibold text-white">
              online &amp; face-to-face programs
            </strong>{" "}
            for secular students, working adults, kids, and even reverts &amp;
            seniors.
          </p>

          <div className="mt-9 flex animate-[fadeUp_0.9s_0.52s_both] flex-wrap items-center gap-3">
            <Link
              href="/courses"
              className="bg-gold text-primary hover:bg-gold-soft inline-flex items-center gap-2 px-7 py-3.5 text-[11px] font-bold tracking-[0.2em] uppercase transition-all hover:-translate-y-0.5"
            >
              Explore Programs <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 border border-white/25 px-7 py-3.5 text-[11px] font-semibold tracking-[0.2em] text-white/80 uppercase transition-colors hover:border-white/60 hover:text-white"
            >
              Student Portal
            </Link>
          </div>

          <p className="border-gold/30 mt-10 animate-[fadeUp_0.9s_0.62s_both] border-l pl-3 text-[11px] tracking-wider text-white/40">
            SEC Reg. No. 2023020084187-00
          </p>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2">
        <ChevronDown className="text-gold/60 h-6 w-6 animate-bounce" />
      </div>
    </section>
  );
}
