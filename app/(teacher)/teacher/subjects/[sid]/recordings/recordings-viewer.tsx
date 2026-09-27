"use client";

import { useState } from "react";
import { AudioLines, PlayCircle, VideoOff } from "lucide-react";
import type {
  TeacherRecording,
  TeacherRecordingBatch,
} from "@/lib/teacher/queries";
import { toPreviewUrl } from "@/lib/batches/drive";
import { batchLabel } from "@/lib/batches/name";
import {
  formatRecordingDate,
  recordingLabel,
} from "@/lib/batches/recording-date";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Recordings grouped by batch on the left, the selected one playing in the
// same Drive preview embed students watch it through.
export function RecordingsViewer({
  batches,
}: {
  batches: TeacherRecordingBatch[];
}) {
  const [active, setActive] = useState<TeacherRecording | null>(null);
  const previewUrl = active ? toPreviewUrl(active.url) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
      {/* On desktop the list is taken out of flow so the player alone sets the
          row height, and the list scrolls within it instead of the page. */}
      <div className="relative">
        <div className="max-h-[50vh] space-y-4 overflow-y-auto lg:absolute lg:inset-0 lg:max-h-none">
          {batches.map((batch) => (
            <section
              key={batch.id}
              className="overflow-hidden rounded-lg border"
            >
              <header className="bg-muted flex items-center gap-2 px-4 py-2.5">
                <h2 className="text-sm font-medium">{batchLabel(batch)}</h2>
                {batch.isActive && <Badge variant="outline">Current</Badge>}
              </header>
              <ul className="divide-y">
                {batch.recordings.map((recording) => {
                  const isActive = active?.id === recording.id;
                  return (
                    <li key={recording.id}>
                      <button
                        type="button"
                        onClick={() => setActive(recording)}
                        aria-current={isActive ? "true" : undefined}
                        className={cn(
                          "hover:bg-muted/50 flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors",
                          isActive && "bg-primary/5 text-primary",
                        )}
                      >
                        <PlayCircle
                          className="text-primary h-4 w-4 flex-none"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {recordingLabel(recording)}
                          </span>
                          {recording.title?.trim() && (
                            <span className="text-muted-foreground block text-xs">
                              {formatRecordingDate(recording.date)}
                            </span>
                          )}
                        </span>
                        {isActive && (
                          <AudioLines
                            className="text-primary h-4 w-4 flex-none animate-pulse"
                            aria-label="Now playing"
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>

      <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
        {previewUrl ? (
          <iframe
            key={previewUrl}
            src={previewUrl}
            allow="autoplay"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
            title={recordingLabel(active!)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-neutral-400">
            <VideoOff className="h-10 w-10" aria-hidden="true" />
            <p className="text-sm">Select a recording to watch</p>
          </div>
        )}
      </div>
    </div>
  );
}
