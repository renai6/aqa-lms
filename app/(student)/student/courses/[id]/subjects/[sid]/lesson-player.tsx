'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Download, PlayCircle, Check, VideoOff } from 'lucide-react'
import { LessonDoneButton } from './lesson-done-button'
import type { StudentLesson } from '@/lib/student/queries'

type Props = {
  lessons: StudentLesson[]
  subjectId: string
  courseId: string
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

export function LessonPlayer({ lessons, subjectId, courseId }: Props) {
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
    <div className="flex flex-col lg:flex-row h-full">
      {/* ── Sidebar ── */}
      <aside className="w-full lg:w-80 shrink-0 max-h-[40vh] lg:max-h-none border-r border-border flex flex-col overflow-hidden">
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
                      aria-expanded={isOpen}
                      className={
                        'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ' +
                        (isPlaying ? 'bg-primary/5' : '')
                      }
                    >
                      {/* Completion indicator */}
                      <span
                        aria-label={lesson.isCompleted ? 'Completed' : `Lesson ${index + 1}`}
                        className={
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
