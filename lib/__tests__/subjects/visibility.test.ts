import { describe, it, expect } from "vitest";
import {
  canSeeSubject,
  subjectGenderFilter,
  enrolleeGenderWhere,
} from "@/lib/subjects/visibility";

describe("canSeeSubject", () => {
  it("shows a mixed subject (null) to everyone, including null-gender users", () => {
    expect(canSeeSubject("MALE", null)).toBe(true);
    expect(canSeeSubject("FEMALE", null)).toBe(true);
    expect(canSeeSubject(null, null)).toBe(true);
  });

  it("shows a restricted subject only to the matching gender", () => {
    expect(canSeeSubject("MALE", "MALE")).toBe(true);
    expect(canSeeSubject("FEMALE", "FEMALE")).toBe(true);
  });

  it("hides a restricted subject from a mismatched gender", () => {
    expect(canSeeSubject("MALE", "FEMALE")).toBe(false);
    expect(canSeeSubject("FEMALE", "MALE")).toBe(false);
  });

  it("fail-closed: a null-gender user cannot see any restricted subject", () => {
    expect(canSeeSubject(null, "MALE")).toBe(false);
    expect(canSeeSubject(null, "FEMALE")).toBe(false);
  });
});

describe("subjectGenderFilter", () => {
  it("restricts a null-gender viewer to unrestricted subjects only", () => {
    expect(subjectGenderFilter(null)).toEqual({ gender: null });
  });

  it("lets a gendered viewer see unrestricted or matching subjects", () => {
    expect(subjectGenderFilter("MALE")).toEqual({
      OR: [{ gender: null }, { gender: "MALE" }],
    });
    expect(subjectGenderFilter("FEMALE")).toEqual({
      OR: [{ gender: null }, { gender: "FEMALE" }],
    });
  });
});

describe("enrolleeGenderWhere", () => {
  it("includes everyone for a mixed subject", () => {
    expect(enrolleeGenderWhere(null)).toEqual({});
  });

  it("requires a matching gender for a restricted subject", () => {
    expect(enrolleeGenderWhere("MALE")).toEqual({ user: { gender: "MALE" } });
    expect(enrolleeGenderWhere("FEMALE")).toEqual({
      user: { gender: "FEMALE" },
    });
  });
});
