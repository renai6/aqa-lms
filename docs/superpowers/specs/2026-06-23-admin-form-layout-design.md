# Admin Form Page Layout — Design Spec

**Date:** 2026-06-23  
**Status:** Approved

## Problem

Admin form pages leave large amounts of empty horizontal space on wide screens. Pages with forms use a constrained `max-w-*` container that pushes content into a narrow column, leaving the rest of the viewport blank.

## Solution: Two-Rule Layout Pattern

Apply one of two layouts to every admin form page, consistently:

### Rule 1 — Create pages: centered single-column card

Used for pages where a new record is being created. No sidebar — the form is the only thing that matters.

- Container: `p-6 max-w-2xl mx-auto space-y-6`
- No sidebar
- Applies to: `/admin/courses/new`

The `mx-auto` centers the card on the page so empty space is distributed symmetrically rather than bunched on the right.

### Rule 2 — Edit/detail pages: full-width two-column grid

Used for pages where an existing record is being viewed or edited. A sidebar provides contextual content alongside the main form.

- Container: `p-6 space-y-6` (no `max-w-*`)
- Grid: `grid grid-cols-1 lg:grid-cols-3 gap-6`
- Main area: `lg:col-span-2` (form or primary content)
- Sidebar: `space-y-4` (context cards, actions, delete button)
- Applies to all edit/detail pages listed below

## Pages Affected

### `/admin/courses/new` (create — Rule 1)

**Change:** Add `mx-auto` to the container.  
**Before:** `p-6 max-w-2xl space-y-6` (left-aligned)  
**After:** `p-6 max-w-2xl mx-auto space-y-6` (centered)  
**Sidebar:** None.

---

### `/admin/courses/[id]` (edit — Rule 2)

**Change:** Remove `max-w-5xl`. Existing `grid grid-cols-1 lg:grid-cols-3` layout fills the page.  
**Before:** `p-6 max-w-5xl space-y-6`  
**After:** `p-6 space-y-6`  
**Sidebar:** Already has Actions card (publish/archive) + CourseImageCard. No content changes.

---

### `/admin/enrollments/[id]` (detail — Rule 2)

**Change:** Remove `max-w-4xl`. Existing `grid grid-cols-1 lg:grid-cols-3` layout fills the page.  
**Before:** `p-6 max-w-4xl space-y-6`  
**After:** `p-6 space-y-6`  
**Sidebar:** Already has Actions card (proof viewer + approve/reject). No content changes.

---

### `/admin/courses/[id]/subjects/[sid]` (edit — Rule 2)

**Change:** Remove `max-w-5xl`. Existing `grid grid-cols-1 lg:grid-cols-3` layout fills the page.  
**Before:** `p-6 max-w-5xl space-y-6`  
**After:** `p-6 space-y-6`  
**Sidebar:** Already has TeacherAssignmentPanel + SchedulePanel + DeleteSubjectButton. No content changes.

---

### `/admin/courses/[id]/subjects/[sid]/lessons/[lid]` (edit — Rule 2)

**Change:** Remove `max-w-2xl`. Add `grid grid-cols-1 lg:grid-cols-3 gap-6` layout. Add sidebar.  
**Before:** `p-6 max-w-2xl space-y-6`, flat layout with form + delete button stacked  
**After:** `p-6 space-y-6`, two-column grid  
**Main (col-span-2):** `EditLessonForm`  
**Sidebar:** 
- Context card: shows Course title and Subject title (so admin knows where this lesson sits without reading the breadcrumb)
- Delete lesson button (moved from below the form into the sidebar)

---

### `/admin/students/[id]` (detail — Rule 2)

**Change:** Remove `max-w-5xl`. Reorganize from vertical stack to two-column grid.  
**Before:** `p-6 max-w-5xl space-y-6`, profile card + enrollments table stacked vertically  
**After:** `p-6 space-y-6`, two-column grid  
**Main (col-span-2):** Enrollments table (primary content, benefits from more width)  
**Sidebar:** Profile card (name, email, gender, status, member since)

## What's Out of Scope

- List pages (`/admin/courses`, `/admin/enrollments`, etc.) — already full-width tables, no change needed
- Dashboard — not a form page
- Users list — no edit page exists yet; apply the pattern when one is built
- Any visual restyling of form fields, cards, or typography — this spec is layout only
