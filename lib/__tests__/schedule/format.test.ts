import { describe, it, expect } from "vitest";
import {
  groupSubjectSchedules,
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
