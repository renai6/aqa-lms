import { describe, it, expect } from "vitest";
import {
  groupSubjectSchedules,
  flattenSubjectSchedules,
  todaysSchedule,
  type SubjectSchedule,
  type SubjectScheduleRow,
} from "@/lib/schedule/format";

// A Wednesday, in Manila.
const WEDNESDAY = new Date("2026-09-16T09:00:00+08:00");

function row(
  over: Partial<SubjectScheduleRow> &
    Pick<SubjectScheduleRow, "day" | "startTime">,
): SubjectScheduleRow {
  return {
    subjectId: "s1",
    subjectTitle: "Arabic Language",
    meetLink: null,
    endTime: "21:00",
    ...over,
  };
}

describe("groupSubjectSchedules", () => {
  it("collapses every meeting of one subject into a single entry", () => {
    const grouped = groupSubjectSchedules(
      [
        row({ day: "MONDAY", startTime: "19:30", endTime: "20:40" }),
        row({ day: "MONDAY", startTime: "20:50", endTime: "21:30" }),
        row({ day: "WEDNESDAY", startTime: "21:30", endTime: "22:35" }),
      ],
      WEDNESDAY,
    );

    expect(grouped).toHaveLength(1);
    expect(grouped[0].subjectTitle).toBe("Arabic Language");
    expect(grouped[0].slots.map((s) => `${s.day} ${s.startTime}`)).toEqual([
      // Today first, then the rest of the week.
      "WEDNESDAY 21:30",
      "MONDAY 19:30",
      "MONDAY 20:50",
    ]);
  });

  it("keeps same-titled subjects of different courses apart", () => {
    const grouped = groupSubjectSchedules(
      [
        row({ day: "THURSDAY", startTime: "19:00" }),
        row({ subjectId: "s2", day: "THURSDAY", startTime: "19:00" }),
      ],
      WEDNESDAY,
    );
    expect(grouped).toHaveLength(2);
  });

  it("carries the course meet link onto the subject", () => {
    const grouped = groupSubjectSchedules(
      [
        row({
          day: "FRIDAY",
          startTime: "19:00",
          meetLink: "https://meet.google.com/abc-defg-hij",
        }),
      ],
      WEDNESDAY,
    );
    expect(grouped[0].meetLink).toBe("https://meet.google.com/abc-defg-hij");
  });

  it("orders subjects by their soonest meeting", () => {
    const grouped = groupSubjectSchedules(
      [
        row({ subjectId: "later", day: "FRIDAY", startTime: "19:00" }),
        row({ subjectId: "sooner", day: "WEDNESDAY", startTime: "19:00" }),
        row({ subjectId: "later", day: "WEDNESDAY", startTime: "08:00" }),
      ],
      WEDNESDAY,
    );
    expect(grouped.map((g) => g.subjectId)).toEqual(["later", "sooner"]);
  });

  it("reads today off the Manila calendar, not the server clock", () => {
    // 01:00 Thursday in Manila is still Wednesday in UTC. Answering from the
    // server clock would push Thursday's class to the end of the strip.
    const grouped = groupSubjectSchedules(
      [
        row({ subjectId: "wed", day: "WEDNESDAY", startTime: "19:00" }),
        row({ subjectId: "thu", day: "THURSDAY", startTime: "19:00" }),
      ],
      new Date("2026-09-17T01:00:00+08:00"),
    );
    expect(grouped.map((g) => g.subjectId)).toEqual(["thu", "wed"]);
  });

  it("returns nothing when there are no schedules", () => {
    expect(groupSubjectSchedules([], WEDNESDAY)).toEqual([]);
  });
});

function sched(
  over: Partial<SubjectSchedule> & Pick<SubjectSchedule, "slots">,
): SubjectSchedule {
  return {
    subjectId: "s1",
    subjectTitle: "Arabic Language",
    meetLink: null,
    ...over,
  };
}

describe("flattenSubjectSchedules", () => {
  it("gives every meeting its own entry", () => {
    const meetings = flattenSubjectSchedules(
      [
        sched({
          slots: [
            { day: "WEDNESDAY", startTime: "19:30", endTime: "20:40" },
            { day: "THURSDAY", startTime: "19:30", endTime: "20:40" },
            { day: "FRIDAY", startTime: "19:30", endTime: "20:40" },
          ],
        }),
      ],
      WEDNESDAY,
    );
    expect(meetings).toHaveLength(3);
  });

  it("orders meetings across subjects, today first", () => {
    const meetings = flattenSubjectSchedules(
      [
        sched({
          subjectId: "fiqh",
          slots: [{ day: "FRIDAY", startTime: "19:00", endTime: "20:00" }],
        }),
        sched({
          subjectId: "arabic",
          slots: [
            { day: "THURSDAY", startTime: "19:00", endTime: "20:00" },
            { day: "WEDNESDAY", startTime: "18:00", endTime: "19:00" },
          ],
        }),
      ],
      WEDNESDAY,
    );
    // A subject's meetings no longer travel together: the flat strip is
    // ordered by when each meeting actually falls.
    expect(
      meetings.map((m) => `${m.subjectId} ${m.slot.day}`),
    ).toEqual([
      "arabic WEDNESDAY",
      "arabic THURSDAY",
      "fiqh FRIDAY",
    ]);
  });

  it("carries the subject and its meet link onto every meeting", () => {
    const meetings = flattenSubjectSchedules(
      [
        sched({
          subjectTitle: "Tafseer",
          meetLink: "https://meet.google.com/abc-defg-hij",
          slots: [
            { day: "THURSDAY", startTime: "19:00", endTime: "20:00" },
            { day: "SATURDAY", startTime: "19:00", endTime: "20:00" },
          ],
        }),
      ],
      WEDNESDAY,
    );
    expect(meetings).toHaveLength(2);
    for (const m of meetings) {
      expect(m.subjectTitle).toBe("Tafseer");
      expect(m.meetLink).toBe("https://meet.google.com/abc-defg-hij");
    }
  });

  it("reads today off the Manila calendar, not the server clock", () => {
    const meetings = flattenSubjectSchedules(
      [
        sched({
          subjectId: "wed",
          slots: [{ day: "WEDNESDAY", startTime: "19:00", endTime: "20:00" }],
        }),
        sched({
          subjectId: "thu",
          slots: [{ day: "THURSDAY", startTime: "19:00", endTime: "20:00" }],
        }),
      ],
      new Date("2026-09-17T01:00:00+08:00"),
    );
    expect(meetings.map((m) => m.subjectId)).toEqual(["thu", "wed"]);
  });

  it("returns nothing when there are no schedules", () => {
    expect(flattenSubjectSchedules([], WEDNESDAY)).toEqual([]);
  });
});

describe("todaysSchedule", () => {
  it("keeps only the meetings that fall today", () => {
    const { today } = todaysSchedule(
      [
        sched({
          slots: [
            { day: "WEDNESDAY", startTime: "19:30", endTime: "20:40" },
            { day: "THURSDAY", startTime: "19:30", endTime: "20:40" },
            { day: "WEDNESDAY", startTime: "18:00", endTime: "19:00" },
          ],
        }),
      ],
      WEDNESDAY,
    );
    expect(today.map((m) => `${m.slot.day} ${m.slot.startTime}`)).toEqual([
      "WEDNESDAY 18:00",
      "WEDNESDAY 19:30",
    ]);
  });

  it("keeps a class that already finished earlier today", () => {
    // 9pm Manila, against a class that ran 6:30-7:15. It stays: a finished
    // class still tells the student they missed nothing.
    const { today } = todaysSchedule(
      [
        sched({
          slots: [{ day: "WEDNESDAY", startTime: "18:30", endTime: "19:15" }],
        }),
      ],
      new Date("2026-09-16T21:00:00+08:00"),
    );
    expect(today).toHaveLength(1);
  });

  it("names the next class when today has none", () => {
    const { today, next } = todaysSchedule(
      [
        sched({
          subjectId: "fiqh",
          slots: [{ day: "SATURDAY", startTime: "19:00", endTime: "20:00" }],
        }),
        sched({
          subjectId: "arabic",
          slots: [{ day: "THURSDAY", startTime: "19:00", endTime: "20:00" }],
        }),
      ],
      WEDNESDAY,
    );
    expect(today).toEqual([]);
    expect(next?.subjectId).toBe("arabic");
  });

  it("offers no next class when there is one today", () => {
    const { today, next } = todaysSchedule(
      [
        sched({
          slots: [
            { day: "WEDNESDAY", startTime: "19:00", endTime: "20:00" },
            { day: "FRIDAY", startTime: "19:00", endTime: "20:00" },
          ],
        }),
      ],
      WEDNESDAY,
    );
    expect(today).toHaveLength(1);
    expect(next).toBeNull();
  });

  it("reads today off the Manila calendar, not the server clock", () => {
    // 01:00 Thursday in Manila is still Wednesday in UTC. Answering from the
    // server clock would report Thursday's class as not being today.
    const { today } = todaysSchedule(
      [
        sched({
          slots: [{ day: "THURSDAY", startTime: "19:00", endTime: "20:00" }],
        }),
      ],
      new Date("2026-09-17T01:00:00+08:00"),
    );
    expect(today).toHaveLength(1);
  });

  it("has neither today nor a next class when there are no schedules", () => {
    expect(todaysSchedule([], WEDNESDAY)).toEqual({ today: [], next: null });
  });
});
