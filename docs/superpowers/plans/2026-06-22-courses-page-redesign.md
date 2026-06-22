# Courses Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `app/(public)/courses/page.tsx` into a polished three-section layout: dark hero banner → light horizontal course cards → dark partial-payment footer band.

**Architecture:** Single file rewrite of the existing server component. No new queries, API routes, or components needed — all required data (`title`, `description`, `imageUrl`, `tuitionFee`) is already fetched by `getPublishedCourses()`. The page remains an async React Server Component.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 (utility classes only, no config file), lucide-react for icons.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `app/(public)/courses/page.tsx` | Full page rewrite — hero, card list, footer band, empty state |

No other files change.

---

### Task 1: Rewrite the courses page

**Files:**
- Modify: `app/(public)/courses/page.tsx`

- [ ] **Step 1: Replace the file with the new implementation**

Replace the entire contents of `app/(public)/courses/page.tsx` with:

```tsx
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { getPublishedCourses } from '@/lib/enrollments/queries'

export const metadata = { title: "Courses — Al-Qur'an Academy" }

export default async function CoursesPage() {
  const courses = await getPublishedCourses()

  return (
    <>
      {/* ── Hero Banner ── */}
      <section
        className="relative bg-zinc-900 min-h-[40vh] flex items-center pt-20 pb-24"
        style={{ clipPath: 'polygon(0 0, 100% 0, 100% 88%, 0 100%)' }}
      >
        {/* Grain texture */}
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full opacity-[0.04] pointer-events-none mix-blend-overlay"
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="grain-courses">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-courses)" />
        </svg>

        {/* Crimson radial glow */}
        <div
          className="absolute top-0 left-0 w-96 h-96 rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, oklch(0.525 0.223 3.958 / 0.2) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 max-w-5xl mx-auto w-full px-4 sm:px-6">
          <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Enrollment Open
          </span>
          <h1 className="mt-4 text-4xl sm:text-5xl font-bold text-white tracking-tight">
            Explore Our Courses
          </h1>
          <p className="mt-3 text-base text-white/70 max-w-xl">
            Guided by the Saudi Ministry curriculum — online and face-to-face
            programs for every learner.
          </p>
        </div>
      </section>

      {/* ── Course List or Empty State ── */}
      {courses.length === 0 ? (
        <section className="bg-background py-24 px-4">
          <div className="flex flex-col items-center text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground/40" />
            <p className="mt-4 text-sm text-muted-foreground">
              No courses available at this time. Check back soon.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="bg-background">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 space-y-6">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="flex flex-col sm:flex-row rounded-xl border shadow-md overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                >
                  {/* Left panel — image */}
                  <div className="relative sm:w-2/5 shrink-0 min-h-[200px]">
                    {course.imageUrl ? (
                      <img
                        src={course.imageUrl}
                        alt={course.title}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                        <span className="text-5xl font-bold text-primary">
                          {course.title.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right panel — content */}
                  <div className="flex flex-1 flex-col justify-between p-6 sm:p-8">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">
                        {course.title}
                      </h2>
                      {course.description && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                          {course.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-6">
                      {course.tuitionFee != null ? (
                        <div>
                          <span className="text-lg font-bold text-foreground">
                            ₱{course.tuitionFee.toLocaleString()}
                          </span>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Flexible installments available
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Contact us for pricing
                        </p>
                      )}
                      <Link
                        href={`/courses/${course.id}/enroll`}
                        className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        Enroll Now
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Partial Payment Band ── */}
          <section className="bg-zinc-900 py-10 px-4">
            <p className="mx-auto max-w-xl text-center text-sm text-white/70">
              All courses support flexible installment payments. Pay a partial
              amount upfront and complete your tuition over time.
            </p>
          </section>
        </>
      )}
    </>
  )
}
```

- [ ] **Step 2: Run the type check / build to verify no TypeScript errors**

```bash
pnpm build
```

Expected: build completes with no type errors. If the build fails due to an unrelated pre-existing error, run `pnpm lint` instead and confirm the courses page has zero lint errors.

- [ ] **Step 3: Commit**

```bash
git add app/(public)/courses/page.tsx
git commit -m "feat: redesign /courses page — hero, horizontal cards, payment footer"
```

---

### Task 2: Visual verification

**Files:** (no changes — read-only verification)

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

Open `http://localhost:3000/courses` in a browser.

- [ ] **Step 2: Verify the hero section**

Check:
- Dark zinc-900 background fills the hero
- "Enrollment Open" crimson pill badge is visible top-left of content
- Headline "Explore Our Courses" appears in large white bold text
- Subheadline appears below in muted white
- The bottom edge of the hero has a diagonal clip into the white section below
- The Navbar overlays the hero without overlap issues (content clears it due to `pt-20`)

- [ ] **Step 3: Verify the course cards**

Check (requires at least one published course in the database):
- Cards are horizontal on sm+ screens, stacked on mobile
- Image fills the left 40% panel; if no image, zinc-800 background with the course initial in crimson
- Title, description (3-line clamp), and fee appear in the right panel
- "₱X,XXX" fee with "Flexible installments available" below it
- "Enroll Now" button is crimson, rounded-full, and links to `/courses/[id]/enroll`
- Cards lift slightly on hover

- [ ] **Step 4: Verify the footer band**

Check:
- Dark zinc-900 band beneath the card list
- Partial-payment note centered in white/70 muted text

- [ ] **Step 5: Verify the empty state**

If no published courses exist in the database, navigate to `/courses` and confirm:
- A centered `BookOpen` icon appears in muted gray
- "No courses available at this time. Check back soon." text below it
- The dark footer band does NOT appear (it's inside the `else` branch)

- [ ] **Step 6: Stop the dev server**

Press `Ctrl+C` in the terminal running `pnpm dev`.
