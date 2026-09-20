import { describe, it, expect } from "vitest";
import {
  formatEnrolledCourses,
  formatEnrolledCourseTypes,
  formatAmountsPaid,
  formatLastPaymentDates,
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

// Amount Paid is positional like Course Type: entry N is what the student has
// paid on course N. Only APPROVED payments are money received, which is the
// same rule `computeBalance` enforces on every other surface.
describe("formatAmountsPaid", () => {
  it("sums each course's approved payments, in course order", () => {
    expect(
      formatAmountsPaid([
        {
          payments: [
            { amount: 1500, status: "APPROVED", createdAt: new Date("2026-07-05T10:00:00+08:00") },
            { amount: 1500, status: "APPROVED", createdAt: new Date("2026-08-04T10:00:00+08:00") },
          ],
        },
        {
          payments: [
            { amount: 1500, status: "APPROVED", createdAt: new Date("2026-08-20T10:00:00+08:00") },
          ],
        },
      ]),
    ).toBe("3000.00; 1500.00");
  });

  it("ignores pending and rejected payments", () => {
    // Money that has not been approved is not money received. Counting it
    // would overstate the roster's takings.
    expect(
      formatAmountsPaid([
        {
          payments: [
            { amount: 1500, status: "APPROVED", createdAt: new Date("2026-07-05T10:00:00+08:00") },
            { amount: 9999, status: "PENDING", createdAt: new Date("2026-08-04T10:00:00+08:00") },
            { amount: 8888, status: "REJECTED", createdAt: new Date("2026-08-05T10:00:00+08:00") },
          ],
        },
      ]),
    ).toBe("1500.00");
  });

  it("leaves an empty slot for a course with no approved payments", () => {
    // The slot has to survive, or Amount Paid stops lining up with Course.
    // Empty rather than 0.00: nothing was received, which is not the same as
    // a payment of zero.
    expect(
      formatAmountsPaid([
        { payments: [] },
        {
          payments: [
            { amount: 1500, status: "APPROVED", createdAt: new Date("2026-08-20T10:00:00+08:00") },
          ],
        },
      ]),
    ).toBe("; 1500.00");
  });

  it("sums in centavos so exact splits do not leave a float residue", () => {
    // 1500.10 + 1500.20 is 3000.3000000000002 in float arithmetic, which
    // renders as a wrong amount against a receipt.
    expect(
      formatAmountsPaid([
        {
          payments: [
            { amount: 1500.1, status: "APPROVED", createdAt: new Date("2026-07-05T10:00:00+08:00") },
            { amount: 1500.2, status: "APPROVED", createdAt: new Date("2026-08-04T10:00:00+08:00") },
          ],
        },
      ]),
    ).toBe("3000.30");
  });

  it("returns an empty string when there are no enrollments", () => {
    expect(formatAmountsPaid([])).toBe("");
  });
});

// Read alongside Amount Paid: the date of the newest approved payment that
// the amount in the same slot includes.
describe("formatLastPaymentDates", () => {
  it("reports each course's most recent approved payment", () => {
    expect(
      formatLastPaymentDates([
        {
          payments: [
            { amount: 1500, status: "APPROVED", createdAt: new Date("2026-07-05T10:00:00+08:00") },
            { amount: 1500, status: "APPROVED", createdAt: new Date("2026-09-05T10:00:00+08:00") },
            { amount: 1500, status: "APPROVED", createdAt: new Date("2026-08-04T10:00:00+08:00") },
          ],
        },
        {
          payments: [
            { amount: 1500, status: "APPROVED", createdAt: new Date("2026-08-20T10:00:00+08:00") },
          ],
        },
      ]),
    ).toBe("2026-09-05; 2026-08-20");
  });

  it("dates the payment on the Manila calendar", () => {
    // 00:30 on 5 September in Manila is 4 September in UTC. The admin
    // checking this against a receipt is on Manila time.
    expect(
      formatLastPaymentDates([
        {
          payments: [
            { amount: 1500, status: "APPROVED", createdAt: new Date("2026-09-05T00:30:00+08:00") },
          ],
        },
      ]),
    ).toBe("2026-09-05");
  });

  it("ignores pending and rejected payments", () => {
    // A pending payment is newer here, and must not become the last payment
    // date for money that never arrived.
    expect(
      formatLastPaymentDates([
        {
          payments: [
            { amount: 1500, status: "APPROVED", createdAt: new Date("2026-07-05T10:00:00+08:00") },
            { amount: 9999, status: "PENDING", createdAt: new Date("2026-09-30T10:00:00+08:00") },
          ],
        },
      ]),
    ).toBe("2026-07-05");
  });

  it("leaves an empty slot for a course with no approved payments", () => {
    expect(
      formatLastPaymentDates([
        { payments: [] },
        {
          payments: [
            { amount: 1500, status: "APPROVED", createdAt: new Date("2026-08-20T10:00:00+08:00") },
          ],
        },
      ]),
    ).toBe("; 2026-08-20");
  });

  it("returns an empty string when there are no enrollments", () => {
    expect(formatLastPaymentDates([])).toBe("");
  });
});
