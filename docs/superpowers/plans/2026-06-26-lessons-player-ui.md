# Lessons Player UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat lesson list on the student subject page with a two-panel layout — scrollable sidebar (left) with accordion lessons, and a Google Drive iframe video player (right).

**Architecture:** Keep `page.tsx` as a Server Component fetching data, extract all interactivity into a new `lesson-player.tsx` `'use client'` component. No query or schema changes needed — `StudentLesson` already has `materialUrl`, `recordingUrl`, and `isCompleted`. Delete the now-unused `tab-switcher.tsx`.

**Tech Stack:** Next.js 16 App Router, React 19 (`useActionState`), Tailwind CSS 4 (no config file — all via `globals.css`), shadcn/ui (`Button` from `components/ui/button`), lucide-react icons.

---

## File Map

| File | Change |
|------|--------|
| `app/(student)/student/courses/[id]/subjects/[sid]/lesson-player.tsx` | **Create** — `'use client'` component: accordion sidebar + iframe player |
| `app/(student)/student/courses/[id]/subjects/[sid]/page.tsx` | **Modify** — two-panel shell, remove TabSwitcher + assessments tab block, render `<LessonPlayer>` |
| `app/(student)/student/courses/[id]/subjects/[sid]/tab-switcher.tsx` | **Delete** |

Unchanged: `lesson-done-button.tsx`, `actions.ts`, `lib/student/queries.ts`

---

### Task 1: Create `lesson-player.tsx` — client component

**Files:**
- Create: `app/(student)/student/courses/[id]/subjects/[sid]/lesson-player.tsx`

This component owns all interactive state: which lesson accordion is open and which video is playing. It renders the full two-panel layout.

- [ ] **Step 1: Create the file with this complete content**

```tsx
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Download, PlayCircle, Check, VideoOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LessonDoneButton } from './lesson-done-button'
import type { StudentLesson } from '@/lib/student/queries'

type Props = {
  lessons: StudentLesson[]
  subjectId: string
  courseId: string
  assessmentsHref: string
}

type ActiveVideo = {
  lessonId: string
  title: string
  previewUrl: string
}

function toPreviewUrl(url: string): string | null {
  const match = url.match(/\/file\/d\/([^/]+)/)
  if (!match) return null
  return `https://drive.google.com/file/d/${match[1]}/preview`
}

export function LessonPlayer({ lessons, subjectId, courseId, assessmentsHref }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeVideo, setActiveVideo] = useState<ActiveVideo | null>(null)

  function toggleLesson(id: string) {
    setExpandedId(prev => (prev === id ? null : id))
  }

  function playRecording(lesson: StudentLesson) {
    if (!lesson.recordingUrl) return
    const previewUrl = toPreviewUrl(lesson.recordingUrl)
    if (!previewUrl) return
    setActiveVideo({ lessonId: lesson.id, title: lesson.title, previewUrl })
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)]">
      {/* ── Sidebar ── */}
      <aside className="w-full lg:w-80 shrink-0 border-r border-border flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {lessons.length === 0 ? (
            <p className="px-4 py-8 text-sm text-center text-muted-foreground">No lessons yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {lessons.map((lesson, index) => {
                const isOpen = expandedId === lesson.id
                const previewUrl = lesson.recordingUrl ? toPreviewUrl(lesson.recordingUrl) : null
                const isPlaying = activeVideo?.lessonId === lesson.id

                return (
                  <li key={lesson.id}>
                    {/* Row header — click to expand/collapse */}
                    <button
                      onClick={() => toggleLesson(lesson.id)}
                      className={
                        'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ' +
                        (isPlaying ? 'bg-primary/5' : '')
                      }
                    >
                      {/* Completion indicator */}
                      <span className={
                        'flex-none w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold ' +
                        (lesson.isCompleted
                          ? 'bg-green-600 border-green-600 text-white'
                          : 'border-muted-foreground text-muted-foreground')
                      }>
                        {lesson.isCompleted ? <Check className="w-3 h-3" aria-hidden="true" /> : index + 1}
                      </span>

                      <span className={
                        'flex-1 text-sm font-medium line-clamp-2 ' +
                        (lesson.isCompleted ? 'text-muted-foreground' : 'text-foreground')
                      }>
                        {lesson.title}
                      </span>

                      {isOpen
                        ? <ChevronDown className="flex-none w-4 h-4 text-muted-foreground" aria-hidden="true" />
                        : <ChevronRight className="flex-none w-4 h-4 text-muted-foreground" aria-hidden="true" />
                      }
                    </button>

                    {/* Expanded content */}
                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 space-y-2 bg-muted/30">
                        {lesson.description && (
                          <p className="text-xs text-muted-foreground">{lesson.description}</p>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {lesson.materialUrl && (
                            <a
                              href={lesson.materialUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                            >
                              <Download className="w-3.5 h-3.5" aria-hidden="true" />
                              Download Material
                            </a>
                          )}

                          {previewUrl && (
                            <button
                              onClick={() => playRecording(lesson)}
                              className={
                                'inline-flex items-center gap-1.5 text-xs font-medium transition-colors ' +
                                (isPlaying ? 'text-primary font-semibold' : 'text-primary hover:underline')
                              }
                            >
                              <PlayCircle className="w-3.5 h-3.5" aria-hidden="true" />
                              {isPlaying ? 'Now Playing' : 'Watch Recording'}
                            </button>
                          )}
                        </div>

                        <div className="pt-1">
                          <LessonDoneButton
                            lessonId={lesson.id}
                            subjectId={subjectId}
                            courseId={courseId}
                            isCompleted={lesson.isCompleted}
                          />
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Assessments footer link */}
        <div className="shrink-0 border-t border-border p-4">
          <a
            href={assessmentsHref}
            className="text-sm font-medium text-primary hover:underline"
          >
            View Assessments →
          </a>
        </div>
      </aside>

      {/* ── Video Player ── */}
      <main className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
        {activeVideo ? (
          <>
            <div className="shrink-0 px-4 py-2 bg-zinc-900 border-b border-zinc-800">
              <p className="text-sm font-medium text-white truncate">{activeVideo.title}</p>
            </div>
            <iframe
              key={activeVideo.previewUrl}
              src={activeVideo.previewUrl}
              allow="autoplay"
              allowFullScreen
              className="flex-1 w-full border-0"
              title={activeVideo.title}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <VideoOff className="w-10 h-10" aria-hidden="true" />
            <p className="text-sm">Select a lesson to watch</p>
          </div>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(student)/student/courses/[id]/subjects/[sid]/lesson-player.tsx"
git commit -m "feat: add LessonPlayer client component with accordion sidebar and Drive iframe"
```

---

### Task 2: Rewrite `page.tsx` — two-panel shell

**Files:**
- Modify: `app/(student)/student/courses/[id]/subjects/[sid]/page.tsx`

Remove the padded content layout, tab switcher, assessments tab block, and flat lesson list. Replace with a slim header bar + `<LessonPlayer>`.

- [ ] **Step 1: Replace the entire file with this content**

```tsx
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { getStudentSubject } from '@/lib/student/queries'
import { LessonPlayer } from './lesson-player'

type Props = {
  params: Promise<{ id: string; sid: string }>
}

export async function generateMetadata({ params }: Props) {
  const { sid } = await params
  void sid
  return { title: 'Subject — AQA Student' }
}

export default async function StudentSubjectPage({ params }: Props) {
  const { id, sid } = await params

  const session = await getSession()
  if (!session) redirect('/login')

  const subject = await getStudentSubject(session.userId, sid)
  if (!subject || subject.courseId !== id) notFound()

  const assessmentsHref = `/student/courses/${id}/subjects/${sid}?tab=assessments`

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">
      {/* ── Header bar ── */}
      <header className="shrink-0 flex items-center gap-3 px-4 h-14 border-b border-border bg-background">
        <Link
          href={'/student/courses/' + id}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          {subject.course.title}
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-sm font-semibold truncate">{subject.title}</h1>
      </header>

      {/* ── Two-panel layout ── */}
      <LessonPlayer
        lessons={subject.lessons}
        subjectId={sid}
        courseId={id}
        assessmentsHref={assessmentsHref}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(student)/student/courses/[id]/subjects/[sid]/page.tsx"
git commit -m "feat: rewrite subject page as two-panel lessons player layout"
```

---

### Task 3: Delete `tab-switcher.tsx`

**Files:**
- Delete: `app/(student)/student/courses/[id]/subjects/[sid]/tab-switcher.tsx`

- [ ] **Step 1: Delete the file**

```bash
git rm "app/(student)/student/courses/[id]/subjects/[sid]/tab-switcher.tsx"
```

- [ ] **Step 2: Verify nothing imports it**

```bash
grep -r "tab-switcher" app/ --include="*.tsx" --include="*.ts"
```

Expected: no output (no remaining imports).

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: delete unused tab-switcher component"
```

---

### Task 4: Manual smoke test

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Navigate to the subject page**

Log in as a student. Go to `/student/courses/<courseId>/subjects/<subjectId>` for a subject that has at least one lesson with a `recordingUrl` set (Google Drive link) and one with a `materialUrl`.

- [ ] **Step 3: Verify the layout**

- Header bar shows: ← Course Title / Subject Title
- Left sidebar shows the lesson list with numbered circles
- Right panel shows the VideoOff icon + "Select a lesson to watch" placeholder
- The page does not scroll — it fills the viewport height

- [ ] **Step 4: Verify accordion**

- Click a lesson row → it expands showing description (if any), Download Material link, Watch Recording button, and Mark as Done button
- Click it again → it collapses
- Click a different lesson → it opens, the previous one closes

- [ ] **Step 5: Verify video playback**

- Expand a lesson with a recording, click "Watch Recording"
- The iframe appears on the right with the lesson title above it
- The lesson row shows "Now Playing" instead of "Watch Recording"
- Click a different lesson's Watch Recording → the iframe updates to the new video

- [ ] **Step 6: Verify material download**

- Expand a lesson with a material URL, click "Download Material"
- The link opens in a new tab

- [ ] **Step 7: Verify Mark as Done**

- Click "Mark as Done" in an expanded lesson → button changes to green "Done" checkmark
- The lesson circle in the sidebar turns green with a checkmark

- [ ] **Step 8: Verify assessments link**

- Click "View Assessments →" at the bottom of the sidebar
- URL changes to `?tab=assessments` (page may show the old assessments list if that route still handles it, or a blank state — either is acceptable for now)

- [ ] **Step 9: Verify mobile layout**

- Resize the browser to below 1024px width
- The sidebar stacks above the player panel
- Both panels are usable
