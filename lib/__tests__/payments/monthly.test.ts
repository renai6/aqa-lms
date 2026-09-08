import { describe, it, expect } from "vitest";
import {
  monthsOwed,
  monthStatus,
  buildMonthlyMatrix,
  type MatrixEnrollment,
} from "@/lib/payments/monthly";

const NOW = new Date("2026-09-08T10:00:00+08:00");

describe("monthsOwed", () => {
  it("owes every month from enrollment through the current month", () => {
    expect(
      monthsOwed(new Date("2026-06-12T09:00:00+08:00"), null, NOW),
    ).toEqual(["2026-06", "2026-07", "2026-08", "2026-09"]);
  });

  it("owes the whole month a student enrolled at the end of", () => {
    // No proration. A student joining on the 28th owes that month in full.
    expect(
      monthsOwed(new Date("2026-09-28T09:00:00+08:00"), null, NOW),
    ).toEqual(["2026-09"]);
  });

  it("crosses a year boundary", () => {
    expect(
      monthsOwed(
        new Date("2026-12-15T09:00:00+08:00"),
        null,
        new Date("2027-01-05T09:00:00+08:00"),
      ),
    ).toEqual(["2026-12", "2027-01"]);
  });

  it("stops accruing at the month the enrollment ended", () => {
    // A removed student owes up to the month they were removed and no more.
    // The row survives so the arrears stay visible and auditable.
    expect(
      monthsOwed(
        new Date("2026-06-12T09:00:00+08:00"),
        new Date("2026-07-20T09:00:00+08:00"),
        NOW,
      ),
    ).toEqual(["2026-06", "2026-07"]);
  });

  it("ignores an end date in the future", () => {
    expect(
      monthsOwed(
        new Date("2026-06-12T09:00:00+08:00"),
        new Date("2027-06-12T09:00:00+08:00"),
        NOW,
      ),
    ).toEqual(["2026-06", "2026-07", "2026-08", "2026-09"]);
  });

  it("returns nothing for an enrollment dated in the future", () => {
    expect(
      monthsOwed(new Date("2026-11-01T09:00:00+08:00"), null, NOW),
    ).toEqual([]);
  });
});

describe("monthStatus", () => {
  it("is paid when the exact fee is covered", () => {
    expect(monthStatus(1500, [1500])).toEqual({ kind: "paid", paid: 1500 });
  });

  it("is paid when several payments sum exactly to the fee", () => {
    // Float summing leaves residuals like 3.64e-12 that render as a permanent
    // one-centavo shortfall. Integer centavos is the reason this passes.
    expect(monthStatus(1500, [500.1, 499.9, 500])).toEqual({
      kind: "paid",
      paid: 1500,
    });
  });

  it("is paid when overpaid, and does not flag it", () => {
    expect(monthStatus(1500, [2000])).toEqual({ kind: "paid", paid: 2000 });
  });

  it("is partial one centavo under the fee, with the shortfall", () => {
    expect(monthStatus(1500, [1499.99])).toEqual({
      kind: "partial",
      paid: 1499.99,
      short: 0.01,
    });
  });

  it("is partial with the shortfall for a part payment", () => {
    expect(monthStatus(1500, [800])).toEqual({
      kind: "partial",
      paid: 800,
      short: 700,
    });
  });

  it("is unpaid with no payments", () => {
    expect(monthStatus(1500, [])).toEqual({ kind: "unpaid" });
  });

  it("is paid when the fee is zero and nothing was paid", () => {
    // Nothing owed is settled, not outstanding.
    expect(monthStatus(0, [])).toEqual({ kind: "paid", paid: 0 });
  });

  it("is unscored when the course has no fee", () => {
    // The money is known; the verdict is not. Reporting "unpaid" here would
    // accuse every student on a course whose fee an admin has not filled in.
    expect(monthStatus(null, [800])).toEqual({ kind: "unscored", paid: 800 });
    expect(monthStatus(null, [])).toEqual({ kind: "unscored", paid: 0 });
  });
});

describe("buildMonthlyMatrix", () => {
  const enrollment = (
    over: Partial<MatrixEnrollment> & Pick<MatrixEnrollment, "id">,
  ): MatrixEnrollment => ({
    enrolledAt: new Date("2026-06-12T09:00:00+08:00"),
    completedAt: null,
    removedAt: null,
    student: { firstName: "A", lastName: "B", email: "a@b.c" },
    payments: [],
    ...over,
  });

  it("spans the union of every enrollment's owed months", () => {
    const matrix = buildMonthlyMatrix(
      [
        enrollment({ id: "e1" }),
        enrollment({
          id: "e2",
          enrolledAt: new Date("2026-08-01T09:00:00+08:00"),
        }),
      ],
      1500,
      NOW,
    );
    expect(matrix.months).toEqual(["2026-06", "2026-07", "2026-08", "2026-09"]);
  });

  it("marks months a student was not yet enrolled for as not owed", () => {
    const matrix = buildMonthlyMatrix(
      [
        enrollment({ id: "e1" }),
        enrollment({
          id: "e2",
          enrolledAt: new Date("2026-08-01T09:00:00+08:00"),
        }),
      ],
      1500,
      NOW,
    );
    const late = matrix.rows.find((r) => r.enrollmentId === "e2")!;
    expect(late.cells.map((c) => c.owed)).toEqual([false, false, true, true]);
  });

  it("counts only approved payments toward a month", () => {
    const matrix = buildMonthlyMatrix(
      [
        enrollment({
          id: "e1",
          enrolledAt: new Date("2026-09-01T09:00:00+08:00"),
          payments: [
            { id: "p1", amount: 1500, periodMonth: "2026-09", status: "PENDING" },
          ],
        }),
      ],
      1500,
      NOW,
    );
    const cell = matrix.rows[0].cells[0];
    expect(cell.owed && cell.status).toEqual({ kind: "unpaid" });
    // A pending payment is not approved money, so it produces no id to link.
    expect(cell.owed && cell.paymentIds).toEqual([]);
  });

  it("flags a month with a pending payment so nobody chases that student", () => {
    const matrix = buildMonthlyMatrix(
      [
        enrollment({
          id: "e1",
          enrolledAt: new Date("2026-09-01T09:00:00+08:00"),
          payments: [
            { id: "p1", amount: 1500, periodMonth: "2026-09", status: "PENDING" },
          ],
        }),
      ],
      1500,
      NOW,
    );
    const cell = matrix.rows[0].cells[0];
    expect(cell.owed && cell.hasPending).toBe(true);
  });

  it("counts partial and unpaid months as behind, and sums the shortfalls", () => {
    const matrix = buildMonthlyMatrix(
      [
        enrollment({
          id: "e1",
          enrolledAt: new Date("2026-08-01T09:00:00+08:00"),
          payments: [
            { id: "p1", amount: 800, periodMonth: "2026-08", status: "APPROVED" },
          ],
        }),
      ],
      1500,
      NOW,
    );
    // August is 700 short, September is untouched: two months, 2200.
    expect(matrix.rows[0].monthsBehind).toBe(2);
    expect(matrix.rows[0].amountBehind).toBe(2200);
  });

  it("holds approved money with no month in a separate unassigned total", () => {
    const matrix = buildMonthlyMatrix(
      [
        enrollment({
          id: "e1",
          enrolledAt: new Date("2026-09-01T09:00:00+08:00"),
          payments: [
            { id: "p1", amount: 1500, periodMonth: null, status: "APPROVED" },
          ],
        }),
      ],
      1500,
      NOW,
    );
    expect(matrix.rows[0].unassigned).toBe(1500);
    // Until someone says which month it covers, it settles nothing.
    expect(matrix.rows[0].amountBehind).toBe(1500);
    // Finding 6: the id behind the figure, so the matrix can link to it.
    expect(matrix.rows[0].unassignedPaymentIds).toEqual(["p1"]);
  });

  it("gives a paid-ahead month its own column and shows the amount", () => {
    // Both pickers offer the next month, so money can legitimately land in a
    // month nobody owes yet. Without a column it would be in no cell and no
    // unassigned total, which is to say nowhere at all.
    const matrix = buildMonthlyMatrix(
      [
        enrollment({
          id: "e1",
          enrolledAt: new Date("2026-09-01T09:00:00+08:00"),
          payments: [
            { id: "p1", amount: 1500, periodMonth: "2026-09", status: "APPROVED" },
            { id: "p2", amount: 1500, periodMonth: "2026-10", status: "APPROVED" },
          ],
        }),
      ],
      1500,
      NOW,
    );
    expect(matrix.months).toEqual(["2026-09", "2026-10"]);
    expect(matrix.rows[0].cells[1]).toEqual({
      month: "2026-10",
      owed: false,
      paid: 1500,
      paymentIds: ["p2"],
    });
    // Not owed, so it settles nothing and skews no tally.
    expect(matrix.rows[0].unassigned).toBe(0);
    expect(matrix.rows[0].amountBehind).toBe(0);
    expect(matrix.tallies[1]).toEqual({
      month: "2026-10",
      paid: 0,
      partial: 0,
      unpaid: 0,
      unscored: 0,
    });
  });

  it("carries the ids of every approved payment summed into a cell, for linking", () => {
    // A month can be paid across more than one approved submission - both ids
    // must survive into the cell, not just the last one written.
    const matrix = buildMonthlyMatrix(
      [
        enrollment({
          id: "e1",
          enrolledAt: new Date("2026-09-01T09:00:00+08:00"),
          payments: [
            { id: "p1", amount: 800, periodMonth: "2026-09", status: "APPROVED" },
            { id: "p2", amount: 700, periodMonth: "2026-09", status: "APPROVED" },
          ],
        }),
      ],
      1500,
      NOW,
    );
    const cell = matrix.rows[0].cells[0];
    expect(cell.owed && cell.paymentIds).toEqual(["p1", "p2"]);
  });

  it("leaves a not-owed month with no money as an empty cell", () => {
    const matrix = buildMonthlyMatrix(
      [
        enrollment({ id: "early" }),
        enrollment({
          id: "late",
          enrolledAt: new Date("2026-09-01T09:00:00+08:00"),
        }),
      ],
      1500,
      NOW,
    );
    const late = matrix.rows.find((r) => r.enrollmentId === "late")!;
    expect(late.cells[0]).toEqual({
      month: "2026-06",
      owed: false,
      paid: 0,
      paymentIds: [],
    });
  });

  it("counts nothing as behind when the course has no fee", () => {
    const matrix = buildMonthlyMatrix(
      [
        enrollment({
          id: "e1",
          enrolledAt: new Date("2026-08-01T09:00:00+08:00"),
        }),
      ],
      null,
      NOW,
    );
    expect(matrix.rows[0].monthsBehind).toBe(0);
    expect(matrix.rows[0].amountBehind).toBe(0);
  });

  it("sorts the most-behind student first", () => {
    const matrix = buildMonthlyMatrix(
      [
        enrollment({
          id: "settled",
          enrolledAt: new Date("2026-09-01T09:00:00+08:00"),
          student: { firstName: "Aisha", lastName: "R", email: "a@x.c" },
          payments: [
            { id: "p1", amount: 1500, periodMonth: "2026-09", status: "APPROVED" },
          ],
        }),
        enrollment({
          id: "behind",
          enrolledAt: new Date("2026-07-01T09:00:00+08:00"),
          student: { firstName: "Yusuf", lastName: "M", email: "y@x.c" },
        }),
      ],
      1500,
      NOW,
    );
    expect(matrix.rows.map((r) => r.enrollmentId)).toEqual([
      "behind",
      "settled",
    ]);
  });

  it("tallies each month column", () => {
    const matrix = buildMonthlyMatrix(
      [
        enrollment({
          id: "e1",
          enrolledAt: new Date("2026-09-01T09:00:00+08:00"),
          payments: [
            { id: "p1", amount: 1500, periodMonth: "2026-09", status: "APPROVED" },
          ],
        }),
        enrollment({
          id: "e2",
          enrolledAt: new Date("2026-09-01T09:00:00+08:00"),
          payments: [
            { id: "p2", amount: 800, periodMonth: "2026-09", status: "APPROVED" },
          ],
        }),
        enrollment({
          id: "e3",
          enrolledAt: new Date("2026-09-01T09:00:00+08:00"),
        }),
      ],
      1500,
      NOW,
    );
    expect(matrix.tallies).toEqual([
      { month: "2026-09", paid: 1, partial: 1, unpaid: 1, unscored: 0 },
    ]);
  });
});
