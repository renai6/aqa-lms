# Enrollment Pages Redesign

**Date:** 2026-06-22
**Routes:**
- Enroll form: `/courses/[id]/enroll` — `app/(public)/courses/[id]/enroll/page.tsx` + `enroll-form.tsx`
- Confirmation: `/enroll/[requestId]` — `app/(public)/enroll/[requestId]/page.tsx`
**Status:** Approved, ready for implementation

---

## Goal

Redesign both public enrollment pages to match the three-band layout introduced in the `/courses` redesign: dark hero → light content → dark footer band. The enroll form page uses the course image as a hero background; the confirmation page uses a green-tinted hero to signal success. No functional or data changes.

---

## Reference

The `/courses` page (`app/(public)/courses/page.tsx`) is the design reference. Reuse the same:
- SVG grain texture pattern (unique `id` per page)
- Crimson radial glow (enroll page only)
- Diagonal clip-path on hero (confirmation page only)
- Dark zinc-900 footer band
- `bg-background` light section between hero and band

---

## Page 1: Enroll Form — `/courses/[id]/enroll`

### Files Changed
- `app/(public)/courses/[id]/enroll/page.tsx` — layout wrapper rewrite
- `app/(public)/courses/[id]/enroll/enroll-form.tsx` — form visual upgrades

### Section 1: Hero

- **Outer:** `relative bg-zinc-900 min-h-[40vh] flex items-center pt-20 pb-24` — **no clip-path** (clean horizontal cut works better with a photo background)
- **Background image:** if `course.imageUrl` is a valid `https?://` URL, render `<img>` as `absolute inset-0 w-full h-full object-cover`. Always overlay with `<div className="absolute inset-0 bg-black/60" />` on top of the image. If no valid image, the zinc-900 base shows through.
- **Grain texture:** same SVG `feTurbulence` pattern, `id="grain-enroll-hero"`
- **Crimson radial glow:** `absolute top-0 left-0 w-96 h-96 rounded-full`, `radial-gradient(circle, oklch(0.525 0.223 3.958 / 0.2) 0%, transparent 70%)`
- **Content** (`relative z-10 max-w-lg mx-auto w-full px-4 sm:px-6`):
  - Badge: `"Enrollment Application"` — crimson pill (`border border-primary/20 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-semibold`)
  - Headline: `"Enroll in {course.title}"` — `text-4xl sm:text-5xl font-bold text-white tracking-tight mt-4`
  - Subheadline: `"Complete the form below to submit your enrollment application. You'll receive a confirmation email once submitted."` — `text-base text-white/70 max-w-xl mt-3`

### Section 2: Form

- **Container:** `bg-background` section, `max-w-lg mx-auto px-4 sm:px-6 py-12`
- **Course info strip** (replaces the plain muted chip):
  - Course title in `font-semibold text-foreground`
  - Fee: `₱{tuitionFee.toLocaleString('en-PH')} text-lg font-bold` with `"Flexible installments available"` below in `text-xs text-muted-foreground`. If fee is null: `"Contact us for pricing"`.
  - Strip uses a `rounded-xl border bg-card p-4` container
- **Field spacing:** `space-y-6` (up from `space-y-4`)
- **Fields unchanged:** firstName, lastName, email — same `<Label>` + `<Input>` from shadcn
- **Payment type — styled toggle cards** (replaces plain radio buttons):
  - Two side-by-side bordered boxes: `flex gap-3`
  - Each is a `<label>` wrapping a hidden `<input type="radio">` + visible styled div
  - Default (unchecked): `rounded-xl border-2 border-border bg-card p-4 cursor-pointer`
  - Selected (checked): `border-primary bg-primary/5` — use `const [paymentType, setPaymentType] = useState<'FULL' | 'PARTIAL'>('FULL')` to track selected value and apply classes conditionally. Default `'FULL'` matches the existing `defaultChecked` behavior.
  - "Full Payment" card: `Banknote` icon from lucide + label + `"Pay the full tuition upfront"` subtext in `text-xs text-muted-foreground`
  - "Partial Payment" card: `CreditCard` icon + label + `"Pay a portion now, rest later"` subtext
  - Hidden `<input type="radio" name="paymentType">` inside each label (preserves form action compatibility)
- **Amount field:** unchanged
- **Error message:** wrap `state.error` in `<div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">` with an `<AlertCircle className="w-4 h-4 shrink-0" />` icon
- **Submit button:** change to `rounded-full` style: `w-full rounded-full bg-primary text-primary-foreground px-6 py-2.5 font-semibold hover:bg-primary/90 transition-colors`

### Section 3: Bottom Band

- `bg-zinc-900 py-10 px-4`
- Centered `text-white/70 text-sm max-w-xl mx-auto text-center`:
  > "Your application will be reviewed by our team within 1–2 business days. You'll receive an email update at the address you provided."

---

## Page 2: Confirmation — `/enroll/[requestId]`

### Files Changed
- `app/(public)/enroll/[requestId]/page.tsx` — full layout rewrite

### Section 1: Hero (green-tinted)

- **Outer:** `relative bg-zinc-900 min-h-[40vh] flex items-center pt-20 pb-24`
- **Clip-path:** `style={{ clipPath: 'polygon(0 0, 100% 0, 100% 88%, 0 100%)' }}` — same diagonal cut as the courses page
- **Grain texture:** same SVG grain, `id="grain-confirm-hero"`
- **Emerald radial glow** (replaces crimson): `radial-gradient(circle, oklch(0.7 0.2 160 / 0.25) 0%, transparent 70%)` — soft green bloom top-left
- **Content** (`relative z-10 max-w-2xl mx-auto w-full px-4 sm:px-6`):
  - Badge: `<CheckCircle2 className="w-3.5 h-3.5" />` icon + `"Application Received"` text — green pill: `border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 rounded-full px-3 py-1 text-xs font-semibold inline-flex items-center gap-1.5`
  - Headline: `"You're all set, {request.firstName}!"` — `text-4xl sm:text-5xl font-bold text-white tracking-tight mt-4`
  - Subheadline: `"Complete your payment and upload proof below. We'll notify you by email once verified."` — `text-base text-white/70 max-w-xl mt-3`

### Section 2: Cards

- **Container:** `bg-background` section, `max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-6`
- **"Your Application" card:**
  - Add `className="border-l-4 border-primary"` to the `<Card>` to give it a crimson left accent
  - Key-value rows: keep the existing `flex gap-4` structure, labels in `text-muted-foreground w-28 shrink-0`, values in `font-medium`
- **"Payment Instructions" card:**
  - GCash row: add `<Smartphone className="w-4 h-4 text-muted-foreground" />` icon before "GCash", wrap the GCash block in `<div className="bg-muted rounded-lg p-3 space-y-0.5">`
  - Bank row: add `<Building2 className="w-4 h-4 text-muted-foreground" />` icon before bank name, same `bg-muted rounded-lg p-3` wrapper
  - Disclaimer text unchanged
- **"Upload Proof of Payment" card:** no visual changes — content and logic unchanged

### Section 3: Bottom Band

- `bg-zinc-900 py-10 px-4`
- Centered `text-white/70 text-sm max-w-xl mx-auto text-center`:
  > "Questions about your application? Reach out to us and we'll be happy to help."

---

## Constraints

- No changes to server actions (`lib/enrollments/actions.ts`) or queries
- `enroll-form.tsx` stays `'use client'` — add `useState` for payment type selection to drive toggle card styling
- `page.tsx` files remain async Server Components
- Tailwind CSS 4 only — no new config, utility classes only
- All lucide icons used: `Banknote`, `CreditCard`, `AlertCircle`, `CheckCircle2`, `Smartphone`, `Building2`
- Image URL validation: only render course image if `/^https?:\/\//.test(course.imageUrl)` (same guard as courses page)
