import { Video } from "lucide-react";
import {
  DAY_LABEL,
  formatTime,
  todaysSchedule,
  type ScheduleMeeting,
  type SubjectSchedule,
} from "@/lib/schedule/format";

// One chip per meeting, so every chip carries the same amount of text and the
// row reads as a uniform strip. Collapsing a subject's meetings into one badge
// meant a six-slot subject rendered as a full-width lozenge next to a pill
// holding a single time.
const CHIP =
  "bg-muted/60 border-border text-foreground inline-flex items-center gap-x-1.5 rounded-full border px-3 py-1.5 text-xs font-medium";

function ChipBody({ meeting }: { meeting: ScheduleMeeting }) {
  return (
    <>
      <span className="font-semibold">{meeting.subjectTitle}</span>
      {/* The subject may wrap on a narrow screen; a time range never breaks
          across lines. */}
      <span className="text-muted-foreground whitespace-nowrap">
        {formatTime(meeting.slot.startTime)}–{formatTime(meeting.slot.endTime)}
      </span>
    </>
  );
}

// When the subject's course has a Google Meet link the chip is the way into
// the class, so the whole chip is the link.
function ScheduleChip({ meeting }: { meeting: ScheduleMeeting }) {
  if (!meeting.meetLink) {
    return (
      <span className={CHIP}>
        <ChipBody meeting={meeting} />
      </span>
    );
  }
  return (
    <a
      href={meeting.meetLink}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Join Google Meet for ${meeting.subjectTitle} at ${formatTime(
        meeting.slot.startTime,
      )}`}
      className={`${CHIP} hover:bg-muted hover:border-input focus-visible:ring-ring/50 transition-colors focus-visible:ring-2 focus-visible:outline-none`}
    >
      <Video className="text-primary h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <ChipBody meeting={meeting} />
    </a>
  );
}

export function ScheduleStrip({ schedules }: { schedules: SubjectSchedule[] }) {
  if (schedules.length === 0) return null;
  const { today, next } = todaysSchedule(schedules);
  return (
    <section className="space-y-3">
      <h2 className="text-muted-foreground text-[11px] font-semibold tracking-[0.15em] uppercase">
        Today&apos;s Schedule
      </h2>
      {today.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {today.map((m) => (
            <ScheduleChip
              key={`${m.subjectId}:${m.slot.day}:${m.slot.startTime}`}
              meeting={m}
            />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          No class today.
          {next && (
            <>
              {" "}
              Next:{" "}
              <span className="text-foreground font-medium">
                {next.subjectTitle}
              </span>
              , {DAY_LABEL[next.slot.day]} {formatTime(next.slot.startTime)}
            </>
          )}
        </p>
      )}
    </section>
  );
}
