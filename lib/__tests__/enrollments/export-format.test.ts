import { describe, it, expect } from "vitest";
import {
  formatEnrolledCourses,
  formatEnrolledCourseTypes,
} from "@/lib/students/format";

// The export is handed around as a roster, so a course a student was removed
// from must not read as though they are still in it.
describe("formatEnrolledCourses", () => {
  it("joins active course titles", () => {
    expect(
      formatEnrolledCourses([
        { courseTitle: "Marhala 1", removedAt: null },
        { courseTitle: "Marhala 2", removedAt: null },
      ]),
    ).toBe("Marhala 1; Marhala 2");
  });

  it("marks a course the student was removed from", () => {
    expect(
      formatEnrolledCourses([
        { courseTitle: "Marhala 1", removedAt: new Date("2026-08-01") },
        { courseTitle: "Marhala 2", removedAt: null },
      ]),
    ).toBe("Marhala 1 (removed); Marhala 2");
  });

  it("returns an empty string when there are no enrollments", () => {
    expect(formatEnrolledCourses([])).toBe("");
  });
});

// The Course Type column is positional: it is read alongside the Course column,
// so entry N of one must describe entry N of the other.
describe("formatEnrolledCourseTypes", () => {
  it("labels each enrolled course's type in order", () => {
    expect(
      formatEnrolledCourseTypes([
        { courseType: "ON_SITE" },
        { courseType: "ONLINE" },
      ]),
    ).toBe("On-Site; Online");
  });

  it("keeps a removed course's slot so the two columns stay aligned", () => {
    const enrollments = [
      { courseTitle: "Marhala 1", removedAt: new Date("2026-08-01"), courseType: "ONLINE" as const },
      { courseTitle: "Marhala 2", removedAt: null, courseType: "ON_SITE" as const },
    ];

    expect(formatEnrolledCourseTypes(enrollments)).toBe("Online; On-Site");
    expect(formatEnrolledCourseTypes(enrollments).split("; ")).toHaveLength(
      formatEnrolledCourses(enrollments).split("; ").length,
    );
  });

  it("returns an empty string when there are no enrollments", () => {
    expect(formatEnrolledCourseTypes([])).toBe("");
  });
});
