import { describe, it, expect } from "vitest";
import { formatEnrolledCourses } from "@/lib/students/format";

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
