// The billing rules for a course paid monthly. Pure and db-free, in the same
// posture as `computeBalance` in ./balance.ts: every admin and student
// surface calls this rather than doing its own month arithmetic, so they
// cannot disagree about which months a student owes.

import {
  toMonthKey,
  monthKeysBetween,
  type MonthKey,
} from "@/lib/time/manila";

// A student owes every Manila month from the one they enrolled in through
// the current one. Accrual stops at completion or removal.
//
// Derived on read, never stored: there is no schedule table and no job that
// writes a row when a month turns over, so this cannot fall out of sync with
// the enrollment. An end date in the future is ignored rather than trusted,
// so a bad value cannot invent months nobody owes yet.
export function monthsOwed(
  enrolledAt: Date,
  endedAt: Date | null,
  now: Date,
): MonthKey[] {
  const last = endedAt !== null && endedAt < now ? endedAt : now;
  return monthKeysBetween(toMonthKey(enrolledAt), toMonthKey(last));
}

export type MonthStatus =
  | { kind: "paid"; paid: number }
  | { kind: "partial"; paid: number; short: number }
  | { kind: "unpaid" }
  // The course has no tuitionFee, so the money is known but the verdict is
  // not. Reporting "unpaid" here would accuse every student on a course whose
  // fee an admin simply has not filled in yet.
  | { kind: "unscored"; paid: number };

// `approvedAmounts` must already be filtered to APPROVED rows for one month.
// Pending and rejected payments are not money received.
export function monthStatus(
  monthlyFee: number | null,
  approvedAmounts: number[],
): MonthStatus {
  // Integer centavos, for the reason ./balance.ts documents: summing floats
  // leaves residuals like 3.64e-12 that render as a permanent one-centavo
  // shortfall. Several payments per month is the normal case here, so the
  // risk is higher than it is for a single enrollment balance.
  const paidCentavos = approvedAmounts.reduce(
    (sum, amount) => sum + Math.round(amount * 100),
    0,
  );
  const paid = paidCentavos / 100;
  if (monthlyFee === null) return { kind: "unscored", paid };

  const feeCentavos = Math.round(monthlyFee * 100);
  // Checked before the zero case so a zero fee reads as settled rather than
  // as an outstanding month nobody can ever pay off.
  if (paidCentavos >= feeCentavos) return { kind: "paid", paid };
  if (paidCentavos === 0) return { kind: "unpaid" };
  return { kind: "partial", paid, short: (feeCentavos - paidCentavos) / 100 };
}

export type MatrixPayment = {
  amount: number;
  periodMonth: MonthKey | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

export type MatrixEnrollment = {
  id: string;
  enrolledAt: Date;
  completedAt: Date | null;
  removedAt: Date | null;
  student: { firstName: string; lastName: string; email: string };
  payments: MatrixPayment[];
};

// A cell is either outside this enrollment's owed range, or a verdict. The
// distinction matters: a student who joined in August has no opinion about
// June, and rendering that as "unpaid" would invent three months of arrears.
export type MonthCell =
  | { month: MonthKey; owed: false }
  | { month: MonthKey; owed: true; status: MonthStatus; hasPending: boolean };

export type MatrixRow = {
  enrollmentId: string;
  studentName: string;
  studentEmail: string;
  removedAt: Date | null;
  // Approved money carrying no month. Deliberately not netted against
  // `amountBehind`: until someone says which month it covers, it settles
  // nothing.
  unassigned: number;
  cells: MonthCell[];
  monthsBehind: number;
  amountBehind: number;
};

export type MonthTally = {
  month: MonthKey;
  paid: number;
  partial: number;
  unpaid: number;
  unscored: number;
};

export type MonthlyMatrix = {
  months: MonthKey[];
  rows: MatrixRow[];
  tallies: MonthTally[];
};

export function buildMonthlyMatrix(
  enrollments: MatrixEnrollment[],
  monthlyFee: number | null,
  now: Date,
): MonthlyMatrix {
  const owedByEnrollment = new Map<string, Set<MonthKey>>();
  const allMonths = new Set<MonthKey>();
  for (const e of enrollments) {
    const owed = monthsOwed(e.enrolledAt, e.removedAt ?? e.completedAt, now);
    owedByEnrollment.set(e.id, new Set(owed));
    for (const m of owed) allMonths.add(m);
  }
  // Keys are zero-padded, so a plain sort orders them chronologically.
  const months = [...allMonths].sort();

  const rows: MatrixRow[] = enrollments.map((e) => {
    const owed = owedByEnrollment.get(e.id) ?? new Set<MonthKey>();
    const approvedByMonth = new Map<MonthKey, number[]>();
    const pendingMonths = new Set<MonthKey>();
    let unassigned = 0;

    for (const p of e.payments) {
      if (p.status === "PENDING") {
        if (p.periodMonth !== null) pendingMonths.add(p.periodMonth);
        continue;
      }
      if (p.status !== "APPROVED") continue;
      if (p.periodMonth === null) {
        unassigned = (Math.round(unassigned * 100) + Math.round(p.amount * 100)) / 100;
        continue;
      }
      const bucket = approvedByMonth.get(p.periodMonth);
      if (bucket) bucket.push(p.amount);
      else approvedByMonth.set(p.periodMonth, [p.amount]);
    }

    let monthsBehind = 0;
    let behindCentavos = 0;
    const cells: MonthCell[] = months.map((month) => {
      if (!owed.has(month)) return { month, owed: false };
      const status = monthStatus(monthlyFee, approvedByMonth.get(month) ?? []);
      if (status.kind === "unpaid") {
        monthsBehind += 1;
        behindCentavos += Math.round((monthlyFee ?? 0) * 100);
      } else if (status.kind === "partial") {
        monthsBehind += 1;
        behindCentavos += Math.round(status.short * 100);
      }
      return {
        month,
        owed: true,
        status,
        hasPending: pendingMonths.has(month),
      };
    });

    return {
      enrollmentId: e.id,
      studentName: `${e.student.firstName} ${e.student.lastName}`,
      studentEmail: e.student.email,
      removedAt: e.removedAt,
      unassigned,
      cells,
      monthsBehind,
      amountBehind: behindCentavos / 100,
    };
  });

  // Most behind first, so the people who need chasing are at the top rather
  // than wherever the alphabet puts them. Name breaks ties for a stable order.
  rows.sort(
    (a, b) =>
      b.amountBehind - a.amountBehind ||
      a.studentName.localeCompare(b.studentName),
  );

  const tallies: MonthTally[] = months.map((month, i) => {
    const tally: MonthTally = {
      month,
      paid: 0,
      partial: 0,
      unpaid: 0,
      unscored: 0,
    };
    for (const row of rows) {
      const cell = row.cells[i];
      if (!cell.owed) continue;
      tally[cell.status.kind] += 1;
    }
    return tally;
  });

  return { months, rows, tallies };
}
