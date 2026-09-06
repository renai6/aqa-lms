"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Download,
  PlayCircle,
  Headphones,
  Presentation,
  Check,
  VideoOff,
  ClipboardList,
  ChevronsRight,
} from "lucide-react";
import { LessonDoneButton } from "./lesson-done-button";
import type {
  StudentLesson,
  StudentAssessment,
  StudentRecording,
} from "@/lib/student/queries";
import { toPreviewUrl } from "@/lib/batches/drive";
import { recordingLabel } from "@/lib/batches/recording-date";

type Props = {
  lessons: StudentLesson[];
  assessments: StudentAssessment[];
  recordings: StudentRecording[];
  subjectId: string;
  courseId: string;
};

function assessmentStatus(a: StudentAssessment): {
  label: string;
  className: string;
} {
  if (a.attempt == null) {
    return { label: "Take", className: "bg-primary/10 text-primary" };
  }
  if (a.attempt.status === "IN_PROGRESS") {
    return { label: "Resume", className: "bg-amber-100 text-amber-700" };
  }
  if (a.attempt.score == null) {
    return { label: "Pending", className: "bg-amber-100 text-amber-700" };
  }
  return {
    label: Math.round(a.attempt.score) + "%",
    className: "bg-emerald-100 text-emerald-700",
  };
}

type Tab = "lessons" | "recordings";

// One key identifies whatever is loaded in the right-hand panel, so a lesson's
// video, a lesson's audio and a class recording can never be "playing" at once.
type ActiveMedia = {
  key: string;
  kindLabel: string;
  title: string;
  previewUrl: string;
};

export function LessonPlayer({
  lessons,
  assessments,
  recordings,
  subjectId,
  courseId,
}: Props) {
  const [tab, setTab] = useState<Tab>("lessons");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeMedia, setActiveMedia] = useState<ActiveMedia | null>(null);

  function toggleLesson(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function play(media: Omit<ActiveMedia, "previewUrl">, url: string) {
    const previewUrl = toPreviewUrl(url);
    if (!previewUrl) return;
    setActiveMedia({ ...media, previewUrl });
  }

  // `activeLabel` exists because a recording row's label is the only thing
  // naming it — swapping in "Now Playing" there would leave the list anonymous.
  // A lesson's entries still swap, since the lesson title stays visible above.
  function mediaEntry(
    key: string,
    label: string,
    onPlay: () => void,
    Icon: typeof PlayCircle,
    activeLabel = "Now Playing",
  ) {
    const isActive = activeMedia?.key === key;
    return (
      <button
        onClick={onPlay}
        className={
          "flex w-full items-center gap-2.5 px-3 py-5 text-xs font-medium text-left transition-colors hover:bg-muted/60 " +
          (isActive ? "text-primary" : "text-foreground")
        }
      >
        <Icon className="flex-none w-4 h-4 text-primary" aria-hidden="true" />
        <span className="flex-1">{isActive ? activeLabel : label}</span>
        {isActive && (
          <span className="flex-none text-[10px] font-semibold uppercase tracking-wide text-primary">
            Live
          </span>
        )}
      </button>
    );
  }

  function tabButton(value: Tab, label: string) {
    const isActive = tab === value;
    return (
      <button
        onClick={() => setTab(value)}
        aria-current={isActive ? "page" : undefined}
        className={
          "flex-1 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors border-b-2 " +
          (isActive
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground")
        }
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-full lg:w-80 shrink-0 max-h-[40vh] lg:max-h-none border-r border-border flex flex-col overflow-hidden">
        <div className="shrink-0 flex border-b border-border">
          {tabButton("lessons", "Lessons")}
          {tabButton("recordings", "Recordings")}
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === "recordings" ? (
            recordings.length === 0 ? (
              <p className="px-4 py-8 text-sm text-center text-muted-foreground">
                No recordings for this subject yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recordings.map((recording) => {
                  const key = "recording:" + recording.id;
                  const label = recordingLabel(recording);
                  return (
                    <li key={recording.id}>
                      {mediaEntry(
                        key,
                        label,
                        () =>
                          play(
                            { key, kindLabel: "Recording", title: label },
                            recording.url,
                          ),
                        PlayCircle,
                        label,
                      )}
                    </li>
                  );
                })}
              </ul>
            )
          ) : lessons.length === 0 ? (
            <p className="px-4 py-8 text-sm text-center text-muted-foreground">
              No lessons yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {lessons.map((lesson, index) => {
                const isOpen = expandedId === lesson.id;
                const videoKey = "lesson:" + lesson.id + ":video";
                const audioKey = "lesson:" + lesson.id + ":audio";
                const videoPreviewUrl = lesson.videoUrl
                  ? toPreviewUrl(lesson.videoUrl)
                  : null;
                const audioPreviewUrl = lesson.audioUrl
                  ? toPreviewUrl(lesson.audioUrl)
                  : null;
                const isPlaying =
                  activeMedia?.key === videoKey || activeMedia?.key === audioKey;

                return (
                  <li key={lesson.id}>
                    {/* Row header — click to expand/collapse. LessonDoneButton
                        renders its own button, so it has to be a sibling of the
                        toggle rather than a child: a button inside a button is
                        invalid HTML and breaks hydration. */}
                    <div
                      className={
                        "w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 " +
                        (isPlaying ? "bg-primary/5" : "")
                      }
                    >
                      <button
                        onClick={() => toggleLesson(lesson.id)}
                        aria-expanded={isOpen}
                        className="flex flex-1 min-w-0 items-center gap-3 text-left"
                      >
                        {/* Completion indicator */}
                        <span
                          aria-label={
                            lesson.isCompleted
                              ? "Completed"
                              : `Lesson ${index + 1}`
                          }
                          className={
                            "flex-none w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold " +
                            (lesson.isCompleted
                              ? "bg-green-600 border-green-600 text-white"
                              : "border-muted-foreground text-muted-foreground")
                          }
                        >
                          {lesson.isCompleted ? (
                            <Check className="w-3 h-3" aria-hidden="true" />
                          ) : (
                            index + 1
                          )}
                        </span>

                        <span
                          className={
                            "flex-1 text-sm font-medium line-clamp-2 " +
                            (lesson.isCompleted
                              ? "text-muted-foreground"
                              : "text-foreground")
                          }
                        >
                          {lesson.title}
                        </span>
                      </button>

                      {lesson.isCompleted && (
                        <LessonDoneButton
                          lessonId={lesson.id}
                          subjectId={subjectId}
                          courseId={courseId}
                          isCompleted={lesson.isCompleted}
                        />
                      )}

                      <button
                        onClick={() => toggleLesson(lesson.id)}
                        aria-expanded={isOpen}
                        aria-label={isOpen ? "Collapse lesson" : "Expand lesson"}
                        className="flex-none text-muted-foreground"
                      >
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="w-4 h-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>

                    {/* Expanded content */}
                    {isOpen && (
                      <div className="pt-1 flex flex-col gap-3 bg-muted/30 border-l-2 border-primary/20">
                        <div className="flex flex-col divide-y divide-border/60 border-border/60 bg-background/40 overflow-hidden border">
                          {lesson.materialUrl && (
                            <a
                              href={lesson.materialUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2.5 px-3 py-5 text-xs font-medium text-foreground transition-colors hover:bg-muted/60"
                            >
                              <Download
                                className="flex-none w-4 h-4 text-primary"
                                aria-hidden="true"
                              />
                              <span className="flex-1">Download Material</span>
                              <ChevronRight
                                className="flex-none w-3.5 h-3.5 text-muted-foreground"
                                aria-hidden="true"
                              />
                            </a>
                          )}

                          {lesson.pptUrl && (
                            <a
                              href={lesson.pptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2.5 px-3 py-5 text-xs font-medium text-foreground transition-colors hover:bg-muted/60"
                            >
                              <Presentation
                                className="flex-none w-4 h-4 text-primary"
                                aria-hidden="true"
                              />
                              <span className="flex-1">Open Slides</span>
                              <ChevronRight
                                className="flex-none w-3.5 h-3.5 text-muted-foreground"
                                aria-hidden="true"
                              />
                            </a>
                          )}

                          {videoPreviewUrl &&
                            mediaEntry(
                              videoKey,
                              "Watch Lesson Video",
                              () =>
                                play(
                                  {
                                    key: videoKey,
                                    kindLabel: "Lesson Video",
                                    title: lesson.title,
                                  },
                                  lesson.videoUrl!,
                                ),
                              PlayCircle,
                            )}

                          {audioPreviewUrl &&
                            mediaEntry(
                              audioKey,
                              "Listen to Audio",
                              () =>
                                play(
                                  {
                                    key: audioKey,
                                    kindLabel: "Audio",
                                    title: lesson.title,
                                  },
                                  lesson.audioUrl!,
                                ),
                              Headphones,
                            )}

                          {!lesson.isCompleted && (
                            <div>
                              <LessonDoneButton
                                lessonId={lesson.id}
                                subjectId={subjectId}
                                courseId={courseId}
                                isCompleted={lesson.isCompleted}
                              />
                            </div>
                          )}

                          {!lesson.materialUrl &&
                            !lesson.pptUrl &&
                            !videoPreviewUrl &&
                            !audioPreviewUrl && (
                              <p className="px-3 py-2 text-xs text-muted-foreground">
                                No materials available.
                              </p>
                            )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* ── Assessments ── */}
          {tab === "lessons" && assessments.length > 0 && (
            <div className="border-t border-border">
              <p className="px-4 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Assessments
              </p>
              <ul className="divide-y divide-border">
                {assessments.map((a) => {
                  const status = assessmentStatus(a);
                  return (
                    <li key={a.id}>
                      <Link
                        href={`/student/courses/${courseId}/subjects/${subjectId}/assessments/${a.id}`}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                      >
                        <ClipboardList
                          className="flex-none w-4 h-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium truncate">
                            {a.title}
                          </span>
                          <span className="block text-[11px] text-muted-foreground uppercase tracking-wide">
                            {a.type}
                          </span>
                        </span>
                        <span
                          className={
                            "flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                            status.className
                          }
                        >
                          {status.label}
                        </span>
                        <ChevronsRight
                          className="flex-none w-4 h-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </aside>

      {/* ── Video Player ── */}
      <main className="dark flex-1 flex flex-col overflow-hidden bg-background">
        {activeMedia ? (
          <>
            <div className="shrink-0 px-4 py-1 bg-card border-b border-border">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {activeMedia.kindLabel}
              </p>
              <p className="text-sm font-medium text-white truncate">
                {activeMedia.title}
              </p>
            </div>
            <div className="relative flex-1 bg-black">
              <iframe
                key={activeMedia.previewUrl}
                src={activeMedia.previewUrl}
                allow="autoplay"
                allowFullScreen
                className="absolute inset-0 w-full h-full border-0"
                title={activeMedia.title}
              />
              {/* Drive draws its own "pop out" button in this corner, inside a
                  cross-origin iframe we cannot style. This cover hides it and,
                  because it takes the pointer events itself, stops the click
                  from ever reaching Drive. Sized with margin around the button
                  rather than to it, since its exact position shifts with the
                  player's own layout. A full-bleed video shows this as a black
                  corner - roughly the weight of the dark button it replaces.
                  It removes the affordance only: restricting access to the
                  file is what Drive's sharing settings are for. */}
              <div
                aria-hidden="true"
                className="absolute top-0 right-0 h-16 w-16 bg-black"
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <VideoOff className="w-10 h-10" aria-hidden="true" />
            <p className="text-sm">Select a lesson to watch</p>
          </div>
        )}
      </main>
    </div>
  );
}
