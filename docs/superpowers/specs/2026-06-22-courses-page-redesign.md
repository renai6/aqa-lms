# Courses Page Redesign

**Date:** 2026-06-22  
**Route:** `/courses` — `app/(public)/courses/page.tsx`  
**Status:** Approved, ready for implementation

---

## Goal

Redesign the public `/courses` page from a minimal flat layout into a polished, modern page that matches the premium aesthetic of the rest of the public site (dark/crimson hero, clean light card section, dark footer band). No new data is needed — all fields already exist on `PublishedCourseRow`.

---

## Layout Overview

Three vertical bands, top to bottom:

1. **Dark hero banner** — zinc-900 background, crimson accent, tagline
2. **Light course list** — white background, horizontal cards
3. **Dark footer band** — zinc-900, partial-payment note (or empty state if no courses)

---

## Section 1: Hero Banner

- **Background:** `bg-zinc-900`, full-width, `min-h-[40vh]`
- **Grain texture:** same SVG `feTurbulence` grain used in `HeroSection.tsx` at ~4% opacity, `mix-blend-overlay`
- **Crimson glow:** a `radial-gradient` positioned top-left, from `oklch(0.525 0.223 3.958)/20%` to transparent — adds depth without being heavy
- **Content (centered, max-w-5xl):**
  - Small crimson pill badge: `"Enrollment Open"` — `bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 text-xs font-semibold`
  - Headline: `"Explore Our Courses"` — `text-4xl sm:text-5xl font-bold text-white`
  - Subheadline: `"Guided by the Saudi Ministry curriculum — online and face-to-face programs for every learner."` — `text-white/70 text-base mt-3 max-w-xl`
- **Bottom transition:** angled clip-path via inline style `clip-path: polygon(0 0, 100% 0, 100% 88%, 0 100%)` — no extra markup needed, creates a clean diagonal bleed into the white section

---

## Section 2: Course Cards

- **Background:** `bg-background` (white in light mode)
- **Container:** `max-w-5xl mx-auto px-4 py-16 space-y-6`
- **Each card:** `flex flex-row rounded-xl border shadow-md overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all duration-200`

### Card left panel (~40% width)
- `w-2/5 shrink-0 relative`
- If `imageUrl` exists: `<img>` with `object-cover h-full w-full`
- If no image: `bg-zinc-800` fallback with the first letter of the course title centered in crimson (`text-primary text-4xl font-bold`)

### Card right panel (~60% width)
- `flex flex-col justify-between p-6 sm:p-8`
- **Title:** `text-xl font-semibold text-foreground`
- **Description:** `text-sm text-muted-foreground line-clamp-3 mt-2`
- **Fee row (bottom of panel):**
  - Fee badge: `text-lg font-bold text-foreground` — displays `₱X,XXX` (formatted with `toLocaleString`). If `tuitionFee` is null, show `"Contact us for pricing"` in muted text.
  - Below fee: `text-xs text-muted-foreground` — `"Flexible installments available"`
- **Enroll Now button:** `mt-4 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-6 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors` — links to `/courses/[id]/enroll`

---

## Section 3: Footer Band / Empty State

### When courses exist
- Full-width `bg-zinc-900` band, `py-10 px-4`
- Centered text: `"All courses support flexible installment payments. Pay a partial amount upfront and complete your tuition over time."`
- Style: `text-white/70 text-sm text-center max-w-xl mx-auto`

### When no courses (empty state)
- Replaces both the card list AND the dark band
- Light background, centered content, `py-24`
- Muted icon (e.g., `BookOpen` from lucide) at `text-muted-foreground/40`
- Text: `"No courses available at this time. Check back soon."` — `text-muted-foreground text-sm mt-4`

---

## Data

No changes to `getPublishedCourses()` or `PublishedCourseRow`. All required fields (`title`, `description`, `imageUrl`, `tuitionFee`) are already fetched.

Fee formatting: `tuitionFee?.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })` or a simple `₱${tuitionFee.toLocaleString()}`.

---

## Constraints

- Single file change: `app/(public)/courses/page.tsx` only (server component, no client needed)
- No new shadcn components required — all styling is Tailwind utility classes
- Must remain a React Server Component (async, no `"use client"`)
- Follows existing Tailwind CSS 4 patterns (no `tailwind.config.js`, utility classes only)
- The Navbar is fixed/overlay — hero must have `pt-20` or similar top padding to clear it
