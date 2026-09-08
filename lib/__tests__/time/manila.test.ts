import { describe, it, expect } from "vitest";
import {
  toMonthKey,
  monthKeyToDate,
  dateToMonthKey,
  nextMonthKey,
  monthKeysBetween,
  monthKeyLabel,
  monthKeyShort,
} from "@/lib/time/manila";

describe("toMonthKey", () => {
  it("reads the month off the Manila calendar, not UTC", () => {
    // 00:30 on 1 October in Manila is still 16:30 on 30 September in UTC.
    // Vercel runs in UTC, so answering this from the server clock bills the
    // student for the wrong month.
    expect(toMonthKey(new Date("2026-10-01T00:30:00+08:00"))).toBe("2026-10");
  });

  it("does not roll a late-UTC instant forward past the Manila month", () => {
    // 23:00 on 30 September UTC is 07:00 on 1 October in Manila.
    expect(toMonthKey(new Date("2026-09-30T23:00:00Z"))).toBe("2026-10");
  });

  it("zero-pads single-digit months so keys sort lexicographically", () => {
    expect(toMonthKey(new Date("2026-03-15T12:00:00+08:00"))).toBe("2026-03");
  });
});

describe("monthKeyToDate / dateToMonthKey", () => {
  it("anchors a month to its first day at UTC midnight", () => {
    expect(monthKeyToDate("2026-09").toISOString()).toBe(
      "2026-09-01T00:00:00.000Z",
    );
  });

  it("round-trips a stored @db.Date value back to its key", () => {
    // Prisma hands a @db.Date column back as UTC midnight. Reading it in
    // Manila time would shift it to 08:00 the same day, which is harmless
    // here, but the operation is a plain unwrap, not a timezone conversion.
    expect(dateToMonthKey(new Date("2026-09-01T00:00:00.000Z"))).toBe("2026-09");
  });

  it("round-trips through both directions", () => {
    expect(dateToMonthKey(monthKeyToDate("2027-01"))).toBe("2027-01");
  });
});

describe("nextMonthKey", () => {
  it("advances within a year", () => {
    expect(nextMonthKey("2026-09")).toBe("2026-10");
  });

  it("rolls December over into the next January", () => {
    expect(nextMonthKey("2026-12")).toBe("2027-01");
  });
});

describe("monthKeysBetween", () => {
  it("is inclusive of both ends", () => {
    expect(monthKeysBetween("2026-06", "2026-09")).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
  });

  it("returns the single month when start equals end", () => {
    expect(monthKeysBetween("2026-06", "2026-06")).toEqual(["2026-06"]);
  });

  it("crosses a year boundary", () => {
    expect(monthKeysBetween("2026-11", "2027-02")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });

  it("returns nothing when the end precedes the start", () => {
    // A naive month-increment loop runs forever here. This is the guard.
    expect(monthKeysBetween("2026-09", "2026-06")).toEqual([]);
  });
});

describe("labels", () => {
  it("renders a full label for headings", () => {
    expect(monthKeyLabel("2026-09")).toBe("September 2026");
  });

  it("renders a short label for matrix columns", () => {
    expect(monthKeyShort("2026-09")).toBe("Sep");
  });
});
