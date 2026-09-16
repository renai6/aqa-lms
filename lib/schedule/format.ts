// lib/schedule/format.ts
//
// One subject's weekly meetings belong in one badge, so the grouping and the
// ordering behind that badge live here rather than in each dashboard that
// renders the strip.
import type { DayOfWeek } from "@prisma/client";

export const DAY_LABEL: Record<DayOfWeek, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

const DAY_NUM: Record<DayOfWeek, number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 7,
};

export type ScheduleSlot = {
  day: DayOfWeek;
  startTime: string;
  endTime: string;
};

// One meeting of one subject, as read out of the database.
export type SubjectScheduleRow = ScheduleSlot & {
  subjectId: string;
  subjectTitle: string;
  // The Google Meet link of the course the subject belongs to, if it has one.
  meetLink: string | null;
};

// All meetings of one subject, which is what a single badge renders.
export type SubjectSchedule = {
  subjectId: string;
  subjectTitle: string;
  meetLink: string | null;
  slots: ScheduleSlot[];
};

// "19:00" -> "7:00 PM"
export function formatTime(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${mStr} ${period}`;
}

const MANILA_WEEKDAY = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  weekday: "long",
});

// Mon=1 … Sun=7 on the Manila calendar. Vercel runs in UTC, so the server
// clock names yesterday for the first eight hours of every Manila day - long
// enough to push today's class to the end of the strip every evening.
function manilaTodayNum(now: Date): number {
  const weekday = MANILA_WEEKDAY.format(now).toUpperCase() as DayOfWeek;
  return DAY_NUM[weekday] ?? 1;
}

// Days until this slot comes round again, counting today as 0.
function daysAway(day: DayOfWeek, todayNum: number): number {
  return ((DAY_NUM[day] ?? 1) - todayNum + 7) % 7;
}

// Collapses the rows into one entry per subject, soonest first - both the
// subjects against each other and the slots within each subject.
export function groupSubjectSchedules(
  rows: SubjectScheduleRow[],
  now: Date = new Date(),
): SubjectSchedule[] {
  const todayNum = manilaTodayNum(now);
  const bySubject = new Map<string, SubjectSchedule>();

  for (const row of rows) {
    let entry = bySubject.get(row.subjectId);
    if (!entry) {
      entry = {
        subjectId: row.subjectId,
        subjectTitle: row.subjectTitle,
        meetLink: row.meetLink,
        slots: [],
      };
      bySubject.set(row.subjectId, entry);
    }
    entry.slots.push({
      day: row.day,
      startTime: row.startTime,
      endTime: row.endTime,
    });
  }

  const compareSlots = (a: ScheduleSlot, b: ScheduleSlot) => {
    const diff = daysAway(a.day, todayNum) - daysAway(b.day, todayNum);
    return diff !== 0 ? diff : a.startTime.localeCompare(b.startTime);
  };

  const grouped = [...bySubject.values()];
  for (const entry of grouped) entry.slots.sort(compareSlots);
  // Every entry has at least one slot: an entry only exists because a row
  // created it.
  grouped.sort((a, b) => compareSlots(a.slots[0], b.slots[0]));
  return grouped;
}

// One meeting of one subject, ready to render as a single chip.
export type ScheduleMeeting = {
  subjectId: string;
  subjectTitle: string;
  meetLink: string | null;
  slot: ScheduleSlot;
};

// Every meeting of every subject as one flat list, soonest first. The strip
// renders a chip per meeting rather than a badge per subject, so a subject
// with six weekly meetings no longer stretches into a full-width lozenge
// beside a one-slot pill. The day arithmetic stays here because `daysAway`
// and the Manila weekday are this module's business, not the component's.
export function flattenSubjectSchedules(
  schedules: SubjectSchedule[],
  now: Date = new Date(),
): ScheduleMeeting[] {
  const todayNum = manilaTodayNum(now);
  const meetings = schedules.flatMap((s) =>
    s.slots.map((slot) => ({
      subjectId: s.subjectId,
      subjectTitle: s.subjectTitle,
      meetLink: s.meetLink,
      slot,
    })),
  );
  meetings.sort((a, b) => {
    const diff =
      daysAway(a.slot.day, todayNum) - daysAway(b.slot.day, todayNum);
    return diff !== 0 ? diff : a.slot.startTime.localeCompare(b.slot.startTime);
  });
  return meetings;
}

export type TodaySchedule = {
  // Every meeting falling on today's Manila date, earliest first.
  today: ScheduleMeeting[];
  // The soonest meeting due, and only when today has none. An empty day that
  // said nothing but "no class today" spent a whole section reporting an
  // absence; naming the next class makes it useful on the four or five days a
  // week a student is not in class.
  next: ScheduleMeeting | null;
};

// What the dashboard strip renders. A meeting is "today" on the Manila
// calendar, not the server's - see `manilaTodayNum`. Meetings earlier today
// are deliberately kept: a finished class still confirms nothing was missed,
// and dropping it mid-class would be worse.
export function todaysSchedule(
  schedules: SubjectSchedule[],
  now: Date = new Date(),
): TodaySchedule {
  const meetings = flattenSubjectSchedules(schedules, now);
  const todayNum = manilaTodayNum(now);
  const today = meetings.filter((m) => daysAway(m.slot.day, todayNum) === 0);
  // `meetings` is already soonest-first, so the head is the next one due.
  return { today, next: today.length > 0 ? null : (meetings[0] ?? null) };
}
