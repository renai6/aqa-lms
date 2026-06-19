# AQA LMS Homepage Redesign

**Date:** 2026-06-19
**Status:** Approved

## Overview

Replace the default Next.js boilerplate homepage (`app/page.tsx`) with a production-quality landing page for Al-Qur'an Academy International (AQA). The design closely follows the reference screenshot while adding modern visual improvements: glassmorphism navbar, animated headline highlights, grain texture, and staggered scroll animations.

The page is intentionally minimal — **hero + affiliations banner + slim footer** only.

---

## Section 1: Navbar

**Behavior:** Fixed, full-width. Starts fully transparent over the hero image, transitions to a glassmorphism state (`backdrop-blur`, semi-transparent dark background, subtle bottom border) once the user scrolls past ~60px. Implemented via a `scroll` event listener + a toggled CSS class.

**Layout:**
- Left: AQA logo — circular emblem mark + "AL-QUR'AN ACADEMY INTERNATIONAL" text lockup (placeholder `<Logo />` component)
- Right: Single "Login" CTA — crimson pill button with a person icon (lucide-react `UserCircle2`), links to `/login`

**Mobile:** Logo + login icon only (no text label on the button).

**Implementation notes:**
- Use a `"use client"` component (`components/homepage/Navbar.tsx`)
- Glassmorphism: `bg-black/20 backdrop-blur-md border-b border-white/10`
- Crimson pill: `bg-primary text-primary-foreground rounded-full px-4 py-2`

---

## Section 2: Hero

**Layout:** `min-h-screen`, content left-aligned and vertically centered with `pl-8 md:pl-16 lg:pl-24` padding. No right-side image or split — full-bleed background.

**Background stack (bottom to top):**
1. Placeholder grey div (`bg-zinc-900`) standing in for a future `/hero-bg.jpg` image
2. Dark gradient overlay: `bg-gradient-to-br from-black/90 via-black/70 to-black/40`
3. SVG grain/noise texture at ~4% opacity, `mix-blend-mode: overlay`

**Headline:** Responsive size (`text-4xl md:text-6xl lg:text-7xl`), bold, white. Two inline `<mark>` spans receive the crimson highlight treatment:
- Span 1: `"credible, high-quality"`
- Span 2: `"Islamic education"`

Each span: `bg-primary text-white px-1` with a slow `@keyframes` gradient animation cycling `crimson → deep rose → crimson` over 4s (`background-size: 200%`, `background-position` animated).

**Below headline (top to bottom):**
- Italic subtitle: *"Guided by the Saudi Ministry curriculum & Ivy League standard"* — `text-lg text-white/80 italic`
- Body paragraph: *"Al-Qur'an Academy (AQA) features **online & face-to-face programs** for secular students, working adults, kids, and even reverts & seniors."* — `text-sm text-white/70 max-w-lg`
- Two CTA buttons in a flex row:
  - **"Explore Programs ↗"** — crimson fill, rounded-full, `ArrowUpRight` icon from lucide-react
  - **"Join AQA Community"** — dark outline (`border border-white/30 text-white hover:bg-white/10`), rounded-full
- SEC Reg. No. `2023020084187-00` — `text-xs text-white/40 mt-6`

**Scroll indicator:** Centered at viewport bottom, an animated `ChevronDown` icon (lucide-react) bouncing via `animate-bounce`, `text-white/50`.

**Implementation notes:**
- Hero is a server component — no client interactivity needed
- Grain texture: inline `<svg>` with `<feTurbulence>` filter, `pointer-events-none absolute inset-0`
- The highlight animation is defined in `app/globals.css` as a `@keyframes shimmer-crimson` rule

---

## Section 3: Affiliations Banner

**Layout:** Full-width, crimson background (`bg-primary`), `py-10`, centered content.

**Content:**
- Centered italic text: *"In affiliation with esteemed institution and partners in Islamic education"* — `text-primary-foreground/90 text-sm italic mb-8`
- Three placeholder circular logos in a flex row, `gap-8`, each:
  - `w-20 h-20 rounded-full bg-white border-2 border-white/80 shadow-inner`
  - Contains a centered grey placeholder icon (`Building2` from lucide-react, `text-zinc-400`)
- Logos animate in on scroll with staggered `opacity-0 → opacity-100 translate-y-4 → translate-y-0` transitions, each delayed 100ms apart
  - Use `IntersectionObserver` in a `"use client"` wrapper component

---

## Section 4: Footer

**Layout:** Dark strip (`bg-zinc-950`), `py-4`, centered.

**Content:** Single line — `© 2025 Al-Qur'an Academy International. All rights reserved.` — `text-xs text-zinc-500`

---

## File Structure

```
app/
  page.tsx                          ← top-level composition (server component)
components/
  homepage/
    Navbar.tsx                      ← "use client", scroll-aware glassmorphism
    HeroSection.tsx                 ← server component
    AffiliationsBanner.tsx          ← "use client", IntersectionObserver animations
    Footer.tsx                      ← server component
app/
  globals.css                       ← add @keyframes shimmer-crimson
```

---

## Styling Constraints

- **Tailwind CSS 4** — no config file; all custom values go in `globals.css` via `@theme inline {}`
- **Primary color** already defined as crimson in `globals.css` (`--primary: oklch(0.525 0.223 3.958)`)
- **No new dependencies** — use lucide-react (already available via shadcn) for all icons
- **shadcn/ui Button component** for the CTA buttons where applicable

---

## Out of Scope

- Navigation links beyond Login (Programs, Faculty, etc.)
- Real AQA logos or hero image (placeholders only)
- Dark mode variant (hero is inherently dark; affiliations banner uses primary color)
- Any below-fold sections (features, programs preview, testimonials, stats)
