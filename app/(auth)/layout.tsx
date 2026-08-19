import Link from "next/link";
import Image from "next/image";
import GeoMotif from "@/components/homepage/GeoMotif";
import Eyebrow from "@/components/homepage/Eyebrow";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* ─── LEFT BRAND PANEL ─── */}
      <aside className="bg-brand-maroon-deep sticky top-0 hidden h-screen w-[460px] shrink-0 flex-col overflow-hidden lg:flex">
        {/* Base wash + depth — maroon deepening toward the footer maroon */}
        <div className="absolute inset-0 bg-[linear-gradient(160deg,#8a1933_0%,#59081b_48%,#3d0510_100%)]" />
        <div className="pointer-events-none absolute -bottom-24 -left-28 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(201,24,66,0.45),transparent_68%)]" />
        <div className="pointer-events-none absolute -top-32 -right-24 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(255,186,112,0.18),transparent_65%)]" />

        {/* Fine grid lines */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,186,112,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,186,112,0.07) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Geometric motif */}
        <GeoMotif className="right-[-160px] bottom-[-160px]" />

        {/* Top: Logo */}
        <div className="relative z-10 flex items-center gap-3.5 p-8">
          <span className="relative flex h-10 w-10 items-center justify-center">
            <span className="border-gold/40 absolute inset-0 rotate-45 border" />
            <Image
              src="/aqa-logo.png"
              alt="Al-Qur'an Academy"
              width={44}
              height={44}
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
          </span>
          <div className="leading-none">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-white uppercase">
              Al-Qur&apos;an Academy
            </p>
            <p className="text-gold/80 mt-1 text-[9px] tracking-[0.28em] uppercase">
              International
            </p>
          </div>
        </div>

        {/* Center: Copy */}
        <div className="relative z-10 flex flex-1 flex-col justify-center px-10 pb-6">
          <Eyebrow className="mb-8">Knowledge · Faith · Excellence</Eyebrow>

          <h1 className="text-[3.2rem] leading-[1.08] font-semibold tracking-tight text-white">
            Learn.
            <br />
            Grow.
            <br />
            <span className="text-gold font-normal">Illuminate.</span>
          </h1>

          <p className="mt-6 max-w-[280px] text-[0.9375rem] leading-relaxed font-light text-white/75">
            Join thousands of students on a journey of knowledge and spiritual
            growth through our structured online curriculum.
          </p>

          {/* Geometric diamond accents */}
          <div className="mt-12 flex items-center gap-3">
            <div className="border-gold/40 h-8 w-8 rotate-45 border-[1.5px]" />
            <div className="border-gold/25 h-5 w-5 rotate-45 border-[1.5px]" />
            <div className="border-gold/15 h-3 w-3 rotate-45 border-[1.5px]" />
          </div>
        </div>

        {/* Bottom: Navigation */}
        <div className="relative z-10 flex gap-7 px-10 pb-10">
          <Link
            href="/"
            className="hover:text-gold flex items-center gap-1.5 text-sm text-white/75 transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M19 12H5M5 12l7-7M5 12l7 7" />
            </svg>
            Home
          </Link>
          <Link
            href="/courses"
            className="hover:text-gold flex items-center gap-1.5 text-sm text-white/75 transition-colors"
          >
            View Courses
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M5 12h14M14 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </aside>

      {/* ─── RIGHT FORM PANEL ─── */}
      <main className="bg-background flex min-h-screen flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="border-border/50 flex items-center justify-between border-b px-6 py-4 lg:hidden">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M19 12H5M5 12l7-7M5 12l7 7" />
            </svg>
            Home
          </Link>
          <Link
            href="/courses"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
          >
            Browse Courses
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M5 12h14M14 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Centered form area */}
        <div className="flex flex-1 items-center justify-center px-8 py-12">
          {children}
        </div>
      </main>
    </div>
  );
}
