import { describe, it, expect } from "vitest";
import { isMovedAway, movedReason } from "@/lib/enrollments/moved";

describe("movedReason / isMovedAway", () => {
  it("round-trips a course move reason", () => {
    expect(movedReason("Marhala 2")).toBe("Moved to Marhala 2");
    expect(isMovedAway(movedReason("Marhala 2"))).toBe(true);
  });

  it("does not treat other removals as moves", () => {
    expect(isMovedAway(null)).toBe(false);
    expect(isMovedAway("")).toBe(false);
    expect(isMovedAway("Transferred to Marhala 2")).toBe(false);
  });
});
