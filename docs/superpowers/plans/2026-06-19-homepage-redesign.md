# AQA LMS Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default Next.js boilerplate `app/page.tsx` with a production-quality AQA landing page consisting of a glassmorphism navbar, full-viewport hero with animated crimson highlights, affiliations banner, and minimal footer.

**Architecture:** Four focused server/client components in `components/homepage/`, composed in `app/page.tsx`. The only client components are `Navbar` (scroll listener) and `AffiliationsBanner` (IntersectionObserver). All animation is CSS — no animation libraries needed.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, lucide-react, TypeScript

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `app/globals.css` | Add `@keyframes shimmer-crimson` + `.highlight-crimson` utility class |
| Modify | `app/page.tsx` | Top-level page — composes all four homepage components |
| Create | `components/homepage/Navbar.tsx` | Scroll-aware glassmorphism nav with logo + Login CTA (`"use client"`) |
| Create | `components/homepage/HeroSection.tsx` | Full-viewport hero — placeholder bg, grain texture, animated headline, CTAs (server) |
| Create | `components/homepage/AffiliationsBanner.tsx` | Crimson banner with staggered scroll animations (`"use client"`) |
| Create | `components/homepage/Footer.tsx` | Minimal dark copyright footer (server) |

---

## Task 1: Add shimmer animation to `app/globals.css`

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add the keyframe and utility class**

Open `app/globals.css` and append the following **after** the `@layer base { ... }` block at the bottom of the file:

```css
@keyframes shimmer-crimson {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.highlight-crimson {
  background: linear-gradient(
    90deg,
    oklch(0.525 0.223 3.958),
    oklch(0.42 0.19 340),
    oklch(0.525 0.223 3.958)
  );
  background-size: 200% 100%;
  color: white;
  padding: 0 0.12em;
  animation: shimmer-crimson 4s ease-in-out infinite;
}
```

- [ ] **Step 2: Verify lint passes**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "style: add shimmer-crimson keyframe and highlight utility"
```

---

## Task 2: Create `Footer` component

**Files:**
- Create: `components/homepage/Footer.tsx`

- [ ] **Step 1: Create the file**

```tsx
export default function Footer() {
  return (
    <footer className="bg-zinc-950 py-4">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <p className="text-xs text-zinc-500">
          &copy; {new Date().getFullYear()} Al-Qur&apos;an Academy International. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Lint check**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/homepage/Footer.tsx
git commit -m "feat: add homepage Footer component"
```

---

## Task 3: Create `HeroSection` component

**Files:**
- Create: `components/homepage/HeroSection.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { ArrowUpRight, ChevronDown } from "lucide-react";
import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Placeholder background — swap for <Image> when /hero-bg.jpg is available */}
      <div className="absolute inset-0 bg-zinc-900" />

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-black/70 to-black/40" />

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
          <span className="highlight-crimson">credible, high-quality</span>
          {" "}
          <span className="highlight-crimson">Islamic education</span>
          {" "}built for busy lives
        </h1>

        <p className="mt-6 text-base sm:text-lg text-white/80 italic">
          Guided by the Saudi Ministry curriculum &amp; Ivy League standard
        </p>

        <p className="mt-4 text-sm text-white/70 max-w-lg leading-relaxed">
          Al-Qur&apos;an Academy (AQA) features{" "}
          <strong className="text-white font-semibold">
            online &amp; face-to-face programs
          </strong>{" "}
          for secular students, working adults, kids, and even reverts &amp; seniors.
        </p>

        <div className="mt-8 flex flex-wrap gap-4 items-center">
          <Link
            href="/programs"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-widest transition-opacity hover:opacity-90"
          >
            Explore Programs <ArrowUpRight className="w-4 h-4" />
          </Link>
          <Link
            href="/community"
            className="inline-flex items-center gap-2 border border-white/30 text-white rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-widest transition-colors hover:bg-white/10"
          >
            Join AQA Community
          </Link>
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
```

- [ ] **Step 2: Lint check**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/homepage/HeroSection.tsx
git commit -m "feat: add homepage HeroSection component"
```

---

## Task 4: Create `AffiliationsBanner` component

**Files:**
- Create: `components/homepage/AffiliationsBanner.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Building2 } from "lucide-react";

const PARTNERS = [
  { id: 1, label: "Partner institution 1" },
  { id: 2, label: "Partner institution 2" },
  { id: 3, label: "Partner institution 3" },
];

export default function AffiliationsBanner() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="bg-primary py-10">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <p className="text-primary-foreground/90 text-sm italic mb-8">
          In affiliation with esteemed institution and partners in Islamic education
        </p>
        <div ref={ref} className="flex justify-center gap-8 flex-wrap">
          {PARTNERS.map((partner, i) => (
            <div
              key={partner.id}
              aria-label={partner.label}
              className="transition-all duration-500 ease-out"
              style={{
                transitionDelay: `${i * 100}ms`,
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(16px)",
              }}
            >
              <div className="w-20 h-20 rounded-full bg-white border-2 border-white/80 shadow-inner flex items-center justify-center">
                <Building2 className="w-8 h-8 text-zinc-400" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Lint check**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/homepage/AffiliationsBanner.tsx
git commit -m "feat: add homepage AffiliationsBanner with scroll animation"
```

---

## Task 5: Create `Navbar` component

**Files:**
- Create: `components/homepage/Navbar.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserCircle2 } from "lucide-react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-black/20 backdrop-blur-md border-b border-white/10"
          : "bg-transparent",
      ].join(" ")}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-primary flex items-center justify-center shrink-0">
            <span className="text-primary font-bold text-xs tracking-tight">AQA</span>
          </div>
          <div className="hidden sm:block leading-none">
            <p className="text-white text-xs font-semibold tracking-wide">
              AL-QUR&apos;AN ACADEMY
            </p>
            <p className="text-white/50 text-[10px] tracking-widest mt-0.5">INTERNATIONAL</p>
          </div>
        </Link>

        {/* Login CTA */}
        <Link
          href="/login"
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
        >
          <UserCircle2 className="w-4 h-4" />
          <span className="hidden sm:inline">Login</span>
        </Link>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Lint check**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/homepage/Navbar.tsx
git commit -m "feat: add homepage Navbar with glassmorphism scroll effect"
```

---

## Task 6: Compose `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace the file content entirely**

```tsx
import Navbar from "@/components/homepage/Navbar";
import HeroSection from "@/components/homepage/HeroSection";
import AffiliationsBanner from "@/components/homepage/AffiliationsBanner";
import Footer from "@/components/homepage/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <AffiliationsBanner />
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 2: Lint check**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Full build check**

```bash
pnpm build
```

Expected: build completes with no TypeScript errors. Ignore any `[31m` color codes in output — those are terminal styling.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: replace homepage boilerplate with AQA landing page"
```

---

## Task 7: Visual verification

**Files:** none (read-only verification)

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

Open `http://localhost:3000` in a browser.

- [ ] **Step 2: Verify navbar behavior**

  - On page load: navbar is fully transparent over the hero
  - After scrolling down 60px+: navbar becomes frosted glass (blurred dark background, bottom border)
  - Logo shows crimson circle "AQA" + "AL-QUR'AN ACADEMY INTERNATIONAL" text (hidden on mobile)
  - Login button (crimson pill) links to `/login`

- [ ] **Step 3: Verify hero section**

  - Section fills the full viewport height
  - Dark overlay over grey placeholder background
  - Headline shows two spans with animated crimson highlight (slow pulsing gradient)
  - Italic subtitle, body paragraph with bold text, two pill CTAs, SEC Reg. No.
  - Bouncing chevron at viewport bottom

- [ ] **Step 4: Verify affiliations banner**

  - Crimson background strip directly below hero
  - On first scroll into view: three circular placeholders animate in with 100ms stagger
  - Circles are white with a grey Building2 icon

- [ ] **Step 5: Verify footer**

  - Dark strip at page bottom with copyright line

- [ ] **Step 6: Final commit (if any tweaks were needed)**

```bash
git add -A
git commit -m "fix: homepage visual tweaks after dev review"
```

---

## Spec Coverage Check

| Spec requirement | Task |
|-----------------|------|
| Glassmorphism navbar — transparent → frosted on scroll | Task 5 |
| Navbar: logo + Login CTA only | Task 5 |
| Hero: placeholder bg + dark overlay | Task 3 |
| Hero: SVG grain texture | Task 3 |
| Hero: animated crimson highlight spans | Tasks 1 + 3 |
| Hero: italic subtitle, body, bold text | Task 3 |
| Hero: "Explore Programs" + "Join AQA Community" CTAs | Task 3 |
| Hero: SEC Reg. No. | Task 3 |
| Hero: bouncing scroll indicator | Task 3 |
| Affiliations: crimson bg, italic text | Task 4 |
| Affiliations: 3 placeholder circles with staggered fade-up | Task 4 |
| Footer: dark strip, copyright | Task 2 |
| globals.css: `@keyframes shimmer-crimson` | Task 1 |
| Page composition in `app/page.tsx` | Task 6 |
