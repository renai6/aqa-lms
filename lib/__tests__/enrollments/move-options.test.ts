import { describe, it, expect } from "vitest";
import {
  courseMoveOptions,
  type CourseMoveTarget,
} from "@/lib/enrollments/move-options";

const batch = { id: "b1", label: "Batch 1" };
const targets: CourseMoveTarget[] = [
  { id: "cA", title: "Marhala 1", paymentFrequency: "ONE_TIME", batches: [batch] },
  { id: "cB", title: "Marhala 2", paymentFrequency: "ONE_TIME", batches: [batch] },
  { id: "cC", title: "Tajweed", paymentFrequency: "MONTHLY", batches: [batch] },
  { id: "cD", title: "Arabic", paymentFrequency: null, batches: [batch] },
  { id: "cE", title: "Fiqh", paymentFrequency: "ONE_TIME", batches: [] },
  { id: "cF", title: "Seerah", paymentFrequency: "ONE_TIME", batches: [batch] },
];

describe("courseMoveOptions", () => {
  const options = courseMoveOptions(targets, {
    courseId: "cA",
    paymentFrequency: "ONE_TIME",
    activeCourseIds: ["cA", "cF"],
  });
  const byId = Object.fromEntries(options.map((o) => [o.id, o]));

  it("drops the current course and courses the student is active in", () => {
    expect(options.map((o) => o.id)).toEqual(["cB", "cC", "cD", "cE"]);
  });

  it("enables a course with the same billing and a batch", () => {
    expect(byId.cB.disabledReason).toBeNull();
  });

  it("disables a course billed differently, null included", () => {
    expect(byId.cC.disabledReason).toBe("Billed differently");
    expect(byId.cD.disabledReason).toBe("Billed differently");
  });

  it("disables a course with no batches", () => {
    expect(byId.cE.disabledReason).toBe("No batches");
  });
});
