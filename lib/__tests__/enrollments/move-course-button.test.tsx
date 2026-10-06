// @vitest-environment jsdom
import { afterEach, beforeAll, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/enrollments/actions", () => ({
  moveEnrollmentCourseAction: vi.fn(),
}));

import { MoveEnrollmentCourseButton } from "@/components/admin/move-enrollment-course-button";
import type { CourseMoveOption } from "@/lib/enrollments/move-options";

const UNTRACKED_NOTE =
  "This enrollment has no tracked balance, so the new course will not track one either.";

const courses: CourseMoveOption[] = [
  {
    id: "cB",
    title: "Marhala 2",
    paymentFrequency: "ONE_TIME",
    batches: [{ id: "b1", label: "Batch 1" }],
    disabledReason: null,
  },
];

// Radix Select leans on pointer-capture and scrolling APIs jsdom lacks.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

afterEach(cleanup);

function openAndPickCourse(totalDue: number | null) {
  render(
    <MoveEnrollmentCourseButton
      enrollmentId="eA"
      studentName="Aisha R"
      courseTitle="Marhala 1"
      totalDue={totalDue}
      courses={courses}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Aisha R/ }));
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Course" }), {
    key: "ArrowDown",
  });
  fireEvent.click(screen.getByRole("option", { name: "Marhala 2" }));
}

describe("MoveEnrollmentCourseButton", () => {
  // The accessible name starts with the visible text, so voice control users
  // can say "click Change course".
  it("names the trigger after its visible text", () => {
    render(
      <MoveEnrollmentCourseButton
        enrollmentId="eA"
        studentName="Aisha R"
        courseTitle="Marhala 1"
        totalDue={null}
        courses={courses}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Change course for Aisha R" }),
    ).toHaveTextContent("Change course");
  });

  it("offers a total for a tracked enrollment, pre-filled from course A", () => {
    openAndPickCourse(12000);

    expect(screen.getByLabelText("Total due")).toHaveValue(12000);
    expect(screen.queryByText(UNTRACKED_NOTE)).toBeNull();
  });

  // The server stores course B untracked anyway, so a field here would only
  // invite a number that gets thrown away.
  it("hides the total for an untracked enrollment and says why", () => {
    openAndPickCourse(null);

    expect(screen.queryByLabelText("Total due")).toBeNull();
    expect(screen.getByText(UNTRACKED_NOTE)).toBeInTheDocument();
  });
});
