import { describe, it, expect } from "vitest";
import { selectableMonths, payableMonths } from "@/lib/payments/monthly";

const NOW = new Date("2026-09-08T10:00:00+08:00");

const enrollment = {
  id: "e1",
  paymentStatus: "PARTIALLY_PAID" as const,
  course: {
    title: "Marhala 1",
    archivedAt: null,
    paymentFrequency: "MONTHLY" as const,
    tuitionFee: 1500,
  },
  enrolledAt: new Date("2026-07-01T09:00:00+08:00"),
  completedAt: null,
  removedAt: null,
  payments: [],
  balance: { kind: "untracked" as const },
};

describe("selectableMonths", () => {
  it("offers unsettled months oldest first, then next month for paying ahead", () => {
    expect(
      selectableMonths(enrollment, [], NOW).map((m) => m.key),
    ).toEqual(["2026-07", "2026-08", "2026-09", "2026-10"]);
  });

  it("drops months already fully paid", () => {
    const months = selectableMonths(
      enrollment,
      [
        { amount: 1500, periodMonth: "2026-07", status: "APPROVED" },
        { amount: 1500, periodMonth: "2026-08", status: "APPROVED" },
      ],
      NOW,
    );
    expect(months.map((m) => m.key)).toEqual(["2026-09", "2026-10"]);
  });

  it("keeps a partially paid month so the student can settle the rest", () => {
    const months = selectableMonths(
      enrollment,
      [{ amount: 800, periodMonth: "2026-07", status: "APPROVED" }],
      NOW,
    );
    expect(months[0].key).toBe("2026-07");
    expect(months[0].status).toEqual({
      kind: "partial",
      paid: 800,
      short: 700,
    });
  });

  it("labels each month for the picker", () => {
    expect(selectableMonths(enrollment, [], NOW)[0].label).toBe("July 2026");
  });

  it("still offers every month when the course fee is zero", () => {
    // A zero fee makes every month read as already paid, so the filtering
    // version returns nothing. `payableMonths` is what the action's bounds
    // check uses precisely so a zero-fee course does not reject everything.
    expect(
      payableMonths(
        {
          enrolledAt: new Date("2026-08-01T09:00:00+08:00"),
          completedAt: null,
          removedAt: null,
        },
        NOW,
      ),
    ).toEqual(["2026-08", "2026-09", "2026-10"]);
  });

  it("offers no look-ahead month for a removed enrollment", () => {
    expect(
      payableMonths(
        {
          enrolledAt: new Date("2026-08-01T09:00:00+08:00"),
          completedAt: null,
          removedAt: new Date("2026-09-02T09:00:00+08:00"),
        },
        NOW,
      ),
    ).toEqual(["2026-08", "2026-09"]);
  });

  it("offers only next month once everything owed is settled", () => {
    const months = selectableMonths(
      enrollment,
      [
        { amount: 1500, periodMonth: "2026-07", status: "APPROVED" },
        { amount: 1500, periodMonth: "2026-08", status: "APPROVED" },
        { amount: 1500, periodMonth: "2026-09", status: "APPROVED" },
      ],
      NOW,
    );
    expect(months.map((m) => m.key)).toEqual(["2026-10"]);
  });
});
