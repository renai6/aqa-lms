import { Playfair_Display } from "next/font/google";
import Link from "next/link";
import Image from "next/image";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-display",
});

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`min-h-screen flex ${playfair.variable}`}>
      {/* ─── LEFT BRAND PANEL ─── */}
      <aside className="hidden lg:flex w-[460px] shrink-0 flex-col relative overflow-hidden sticky top-0 h-screen bg-primary/90">
        {/* Dot-grid texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.16) 1.5px, transparent 1.5px)",
            backgroundSize: "26px 26px",
          }}
        />
        {/* Center radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 45%, rgba(255,255,255,0.11) 0%, transparent 68%)",
          }}
        />
        {/* Large decorative circle */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: "520px",
            height: "520px",
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.08)",
            bottom: "-120px",
            right: "-160px",
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            width: "360px",
            height: "360px",
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.06)",
            bottom: "-60px",
            right: "-100px",
          }}
        />

        {/* Top: Logo */}
        <div className="relative z-10 p-8 flex items-center gap-3.5">
          <Image
            src="/aqa-logo.png"
            alt="Al-Qur'an Academy"
            width={44}
            height={44}
            className="h-10 w-10 rounded-full object-cover shrink-0"
          />
          <div className="leading-none">
            <p className="text-white text-[11px] font-semibold tracking-[0.18em] uppercase">
              Al-Qur&apos;an Academy
            </p>
            <p className="text-white/45 text-[9px] tracking-[0.28em] mt-1 uppercase">
              International
            </p>
          </div>
        </div>

        {/* Center: Copy */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-10 pb-6">
          <div
            className="w-10 h-px mb-8"
            style={{ backgroundColor: "rgba(255,255,255,0.28)" }}
          />

          <h1
            className="text-white leading-[1.08] tracking-tight"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "3.2rem",
              fontWeight: 700,
            }}
          >
            Learn.
            <br />
            Grow.
            <br />
            Illuminate.
          </h1>

          <p
            className="mt-6 leading-relaxed"
            style={{
              color: "rgba(255,255,255,0.62)",
              fontSize: "0.9375rem",
              maxWidth: "280px",
            }}
          >
            Join thousands of students on a journey of knowledge and spiritual
            growth through our structured online curriculum.
          </p>

          {/* Geometric diamond accents */}
          <div className="mt-12 flex items-center gap-3">
            <div
              className="w-8 h-8 rotate-45"
              style={{ border: "1.5px solid rgba(255,255,255,0.22)" }}
            />
            <div
              className="w-5 h-5 rotate-45"
              style={{ border: "1.5px solid rgba(255,255,255,0.16)" }}
            />
            <div
              className="w-3 h-3 rotate-45"
              style={{ border: "1.5px solid rgba(255,255,255,0.1)" }}
            />
          </div>
        </div>

        {/* Bottom: Navigation */}
        <div className="relative z-10 px-10 pb-10 flex gap-7">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-white/65 hover:text-white transition-colors"
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
            className="flex items-center gap-1.5 text-sm text-white/65 hover:text-white transition-colors"
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
      <main className="flex-1 flex flex-col min-h-screen bg-background">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center justify-between px-6 py-4 border-b border-border/50">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
        <div className="flex-1 flex items-center justify-center px-8 py-12">
          {children}
        </div>
      </main>
    </div>
  );
}
