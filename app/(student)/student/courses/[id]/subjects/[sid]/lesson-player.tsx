"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Download,
  PlayCircle,
  Check,
  VideoOff,
  ClipboardList,
  ChevronsRight,
} from "lucide-react";
import { LessonDoneButton } from "./lesson-done-button";
import type { StudentLesson, StudentAssessment } from "@/lib/student/queries";
import { toPreviewUrl } from "@/lib/batches/drive";

type Props = {
  lessons: StudentLesson[];
  assessments: StudentAssessment[];
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

type VideoKind = "video" | "recording";

type ActiveVideo = {
  lessonId: string;
  kind: VideoKind;
  title: string;
  previewUrl: string;
};

export function LessonPlayer({
  lessons,
  assessments,
  subjectId,
  courseId,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<ActiveVideo | null>(null);

  function toggleLesson(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function playVideo(lesson: StudentLesson, kind: VideoKind) {
    const url = kind === "video" ? lesson.videoUrl : lesson.recordingUrl;
    if (!url) return;
    const previewUrl = toPreviewUrl(url);
    if (!previewUrl) return;
    setActiveVideo({ lessonId: lesson.id, kind, title: lesson.title, previewUrl });
  }

  function videoEntry(lesson: StudentLesson, kind: VideoKind, label: string) {
    const isActive = activeVideo?.lessonId === lesson.id && activeVideo.kind === kind;
    return (
      <button
        onClick={() => playVideo(lesson, kind)}
        className={
          "flex w-full items-center gap-2.5 px-3 py-5 text-xs font-medium text-left transition-colors hover:bg-muted/60 " +
          (isActive ? "text-primary" : "text-foreground")
        }
      >
        <PlayCircle className="flex-none w-4 h-4 text-primary" aria-hidden="true" />
        <span className="flex-1">{isActive ? "Now Playing" : label}</span>
        {isActive && (
          <span className="flex-none text-[10px] font-semibold uppercase tracking-wide text-primary">
            Live
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-full lg:w-80 shrink-0 max-h-[40vh] lg:max-h-none border-r border-border flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {lessons.length === 0 ? (
            <p className="px-4 py-8 text-sm text-center text-muted-foreground">
              No lessons yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {lessons.map((lesson, index) => {
                const isOpen = expandedId === lesson.id;
                const videoPreviewUrl = lesson.videoUrl
                  ? toPreviewUrl(lesson.videoUrl)
                  : null;
                const recordingPreviewUrl = lesson.recordingUrl
                  ? toPreviewUrl(lesson.recordingUrl)
                  : null;
                const isPlaying = activeVideo?.lessonId === lesson.id;

                return (
                  <li key={lesson.id}>
                    {/* Row header — click to expand/collapse */}
                    <button
                      onClick={() => toggleLesson(lesson.id)}
                      aria-expanded={isOpen}
                      className={
                        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 " +
                        (isPlaying ? "bg-primary/5" : "")
                      }
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

                      <div className="flex items-center gap-2">
                        {lesson.isCompleted && (
                          <div>
                            <LessonDoneButton
                              lessonId={lesson.id}
                              subjectId={subjectId}
                              courseId={courseId}
                              isCompleted={lesson.isCompleted}
                            />
                          </div>
                        )}

                        {isOpen ? (
                          <ChevronDown
                            className="flex-none w-4 h-4 text-muted-foreground"
                            aria-hidden="true"
                          />
                        ) : (
                          <ChevronRight
                            className="flex-none w-4 h-4 text-muted-foreground"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    </button>

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

                          {videoPreviewUrl &&
                            videoEntry(lesson, "video", "Watch Lesson Video")}

                          {recordingPreviewUrl &&
                            videoEntry(lesson, "recording", "Watch Recording")}

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
                            !videoPreviewUrl &&
                            !recordingPreviewUrl && (
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
          {assessments.length > 0 && (
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
        {activeVideo ? (
          <>
            <div className="shrink-0 px-4 py-1 bg-card border-b border-border">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {activeVideo.kind === "video" ? "Lesson Video" : "Recording"}
              </p>
              <p className="text-sm font-medium text-white truncate">
                {activeVideo.title}
              </p>
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
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <VideoOff className="w-10 h-10" aria-hidden="true" />
            <p className="text-sm">Select a lesson to watch</p>
          </div>
        )}
      </main>
    </div>
  );
}
