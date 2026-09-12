import { Video } from "lucide-react";
import {
  DAY_LABEL,
  formatTime,
  type SubjectSchedule,
} from "@/lib/schedule/format";

// `rounded-2xl` rather than `rounded-full`: at this height the two are
// indistinguishable on one line, and a subject with enough meetings to wrap
// stays a rounded card instead of stretching into a lozenge.
const BADGE =
  "bg-muted/60 border-border text-foreground inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-2xl border px-3.5 py-1.5 text-xs font-medium";

function Slots({ schedule }: { schedule: SubjectSchedule }) {
  return (
    <>
      <span className="font-semibold">{schedule.subjectTitle}</span>
      {schedule.slots.map((slot, i) => (
        <span key={i} className="text-muted-foreground whitespace-nowrap">
          <span className="text-muted-foreground/60" aria-hidden="true">
            ·{" "}
          </span>
          {DAY_LABEL[slot.day]} {formatTime(slot.startTime)}–
          {formatTime(slot.endTime)}
        </span>
      ))}
    </>
  );
}

// One badge per subject. When the subject's course has a Google Meet link the
// badge is the way into the class, so the whole pill is the link.
function ScheduleBadge({ schedule }: { schedule: SubjectSchedule }) {
  if (!schedule.meetLink) {
    return (
      <span className={BADGE}>
        <Slots schedule={schedule} />
      </span>
    );
  }
  return (
    <a
      href={schedule.meetLink}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Join Google Meet for ${schedule.subjectTitle}`}
      className={`${BADGE} hover:bg-muted hover:border-input focus-visible:ring-ring/50 transition-colors focus-visible:ring-2 focus-visible:outline-none`}
    >
      <Video className="text-primary h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <Slots schedule={schedule} />
    </a>
  );
}

export function ScheduleStrip({ schedules }: { schedules: SubjectSchedule[] }) {
  if (schedules.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-muted-foreground text-[10px] font-semibold tracking-[0.2em] uppercase">
        Upcoming Schedule
      </h2>
      <div className="flex flex-wrap gap-2">
        {schedules.map((s) => (
          <ScheduleBadge key={s.subjectId} schedule={s} />
        ))}
      </div>
    </section>
  );
}
