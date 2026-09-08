// The billing rules for a course paid monthly. Pure and db-free, in the same
// posture as `computeBalance` in ./balance.ts: every admin and student
// surface calls this rather than doing its own month arithmetic, so they
// cannot disagree about which months a student owes.

import {
  toMonthKey,
  monthKeysBetween,
  nextMonthKey,
  monthKeyLabel,
  type MonthKey,
} from "@/lib/time/manila";
import { peso } from "@/lib/payments/balance";

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

// Integer centavos, for the reason ./balance.ts documents: summing floats
// leaves residuals like 3.64e-12 that render as a permanent one-centavo
// shortfall. Several payments per month is the normal case here, so the risk
// is higher than it is for a single enrollment balance.
function sumCentavos(amounts: number[]): number {
  return amounts.reduce((sum, amount) => sum + Math.round(amount * 100), 0);
}

// `approvedAmounts` must already be filtered to APPROVED rows for one month.
// Pending and rejected payments are not money received.
export function monthStatus(
  monthlyFee: number | null,
  approvedAmounts: number[],
): MonthStatus {
  const paidCentavos = sumCentavos(approvedAmounts);
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
  // The matrix links a cell to the payment(s) behind it (Finding 6), which
  // needs an id `MatrixPayment` itself does not carry - `selectableMonths`
  // below reuses `MatrixPayment` for the student picker, which has no use
  // for one.
  payments: (MatrixPayment & { id: string })[];
};

// A cell is either outside this enrollment's owed range, or a verdict. The
// distinction matters: a student who joined in August has no opinion about
// June, and rendering that as "unpaid" would invent three months of arrears.
//
// A not-owed cell still carries `paid`, because a student may legitimately
// pay into a month they do not owe yet: both the student picker and the admin
// month select deliberately offer the next month. That money has to render
// somewhere, and it is not "unassigned" - it names its month.
//
// `paymentIds` is the APPROVED payments summed into this cell, in no
// particular order. It exists so the matrix can link a cell that carries
// money to the payment(s) behind it - a pending-only cell (owed, `unpaid`,
// `hasPending`) carries no id here, since that payment is not yet approved
// money and is already reachable through the Pending tab.
export type MonthCell =
  | { month: MonthKey; owed: false; paid: number; paymentIds: string[] }
  | {
      month: MonthKey;
      owed: true;
      status: MonthStatus;
      hasPending: boolean;
      paymentIds: string[];
    };

export type MatrixRow = {
  enrollmentId: string;
  studentName: string;
  studentEmail: string;
  removedAt: Date | null;
  // Approved money carrying no month. Deliberately not netted against
  // `amountBehind`: until someone says which month it covers, it settles
  // nothing.
  unassigned: number;
  // The APPROVED, no-month payments summed into `unassigned`, so the matrix
  // can link the figure to the payment(s) it represents rather than leaving
  // it a dead end.
  unassignedPaymentIds: string[];
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
    // A month somebody has paid into gets a column even when nobody owes it
    // yet. `monthsOwed` stops at the current month while paying ahead is
    // deliberately offered, so without this a payment approved for next month
    // would sit in no cell and no unassigned total - invisible, and
    // permanently so once the enrollment ends.
    for (const p of e.payments) {
      if (p.status === "APPROVED" && p.periodMonth !== null) {
        allMonths.add(p.periodMonth);
      }
    }
  }
  // Keys are zero-padded, so a plain sort orders them chronologically.
  const months = [...allMonths].sort();

  const rows: MatrixRow[] = enrollments.map((e) => {
    const owed = owedByEnrollment.get(e.id) ?? new Set<MonthKey>();
    const approvedByMonth = new Map<MonthKey, { amount: number; id: string }[]>();
    const pendingMonths = new Set<MonthKey>();
    let unassigned = 0;
    const unassignedPaymentIds: string[] = [];

    for (const p of e.payments) {
      if (p.status === "PENDING") {
        if (p.periodMonth !== null) pendingMonths.add(p.periodMonth);
        continue;
      }
      if (p.status !== "APPROVED") continue;
      if (p.periodMonth === null) {
        unassigned = sumCentavos([unassigned, p.amount]) / 100;
        unassignedPaymentIds.push(p.id);
        continue;
      }
      const bucket = approvedByMonth.get(p.periodMonth);
      const entry = { amount: p.amount, id: p.id };
      if (bucket) bucket.push(entry);
      else approvedByMonth.set(p.periodMonth, [entry]);
    }

    let monthsBehind = 0;
    let behindCentavos = 0;
    const cells: MonthCell[] = months.map((month) => {
      const bucket = approvedByMonth.get(month) ?? [];
      const paymentIds = bucket.map((x) => x.id);
      if (!owed.has(month)) {
        return {
          month,
          owed: false,
          paid: sumCentavos(bucket.map((x) => x.amount)) / 100,
          paymentIds,
        };
      }
      const status = monthStatus(
        monthlyFee,
        bucket.map((x) => x.amount),
      );
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
        paymentIds,
      };
    });

    return {
      enrollmentId: e.id,
      studentName: `${e.student.firstName} ${e.student.lastName}`,
      studentEmail: e.student.email,
      removedAt: e.removedAt,
      unassigned,
      unassignedPaymentIds,
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

export type SelectableMonth = {
  key: MonthKey;
  label: string;
  status: MonthStatus;
};

export type PayableEnrollment = {
  enrolledAt: Date;
  completedAt: Date | null;
  removedAt: Date | null;
};

// Every month a payment may legitimately be filed against: the owed months
// plus one look-ahead so a student can pay next month early. Paying ahead is
// only offered while the enrollment is still accruing - a removed or
// completed student has no next month to pay for.
//
// This is the bounds check, and it is deliberately separate from
// `selectableMonths` below, which FILTERS this list down to what is still
// outstanding. Using the filtering version as a bounds check rejects every
// submission on a course whose fee is zero, because a zero fee makes every
// month read as already paid.
export function payableMonths(
  enrollment: PayableEnrollment,
  now: Date,
): MonthKey[] {
  const owed = monthsOwed(
    enrollment.enrolledAt,
    enrollment.removedAt ?? enrollment.completedAt,
    now,
  );
  const last = owed[owed.length - 1];
  if (
    last === undefined ||
    enrollment.removedAt !== null ||
    enrollment.completedAt !== null
  ) {
    return owed;
  }
  return [...owed, nextMonthKey(last)];
}

// The options in the student's "Paying for" picker: every payable month that
// is not fully settled, oldest first. Oldest first because a student catching
// up almost always means the oldest one, and it is what the form defaults to.
export function selectableMonths(
  enrollment: {
    enrolledAt: Date;
    completedAt: Date | null;
    removedAt: Date | null;
    course: { tuitionFee: number | null };
  },
  payments: MatrixPayment[],
  now: Date,
): SelectableMonth[] {
  const approvedByMonth = new Map<MonthKey, number[]>();
  for (const p of payments) {
    if (p.status !== "APPROVED" || p.periodMonth === null) continue;
    const bucket = approvedByMonth.get(p.periodMonth);
    if (bucket) bucket.push(p.amount);
    else approvedByMonth.set(p.periodMonth, [p.amount]);
  }

  const fee = enrollment.course.tuitionFee;
  return payableMonths(enrollment, now)
    .map((key) => ({
      key,
      label: monthKeyLabel(key),
      status: monthStatus(fee, approvedByMonth.get(key) ?? []),
    }))
    .filter((m) => m.status.kind !== "paid");
}

// The monthly counterpart to `describeBalance` in ./balance.ts: the one
// place every admin and student surface reads a monthly billing line from,
// so they cannot disagree about the wording. `Enrollment.totalDue` is
// supposed to stay null for a monthly course, but a handful of rows predate
// that rule and still carry one - callers must not gate on `totalDue` (or on
// `Balance.kind`) to decide whether to use this. The course being MONTHLY is
// the only question that matters.
//
// Two functions, not one with a mode flag: they answer genuinely different
// questions with different inputs. `describeMonthlyPeriod` describes ONE
// named month (a specific payment's `periodMonth`) from that month's own
// paid/short figures. `describeMonthlyStanding` describes an ENROLLMENT'S
// overall state across every month it owes, and has to decide which month(s)
// to name itself. Folding both into one signature would force every caller
// to pass fields the other does not need.

// Both months share a year (`MonthKey` is "YYYY-MM", so this is a plain
// string compare, not a date computation), so `monthKeyLabel(a)` would repeat
// it. "August and September 2026" states the year once, on the later month.
function joinMonthNames(a: MonthKey, b: MonthKey): string {
  const labelB = monthKeyLabel(b);
  if (a.slice(0, 4) === b.slice(0, 4)) {
    const nameA = monthKeyLabel(a).split(" ")[0];
    return `${nameA} and ${labelB}`;
  }
  return `${monthKeyLabel(a)} and ${labelB}`;
}

// Describes the billing state of one specific month - what a single payment
// (or a specific cell of the matrix) covers. `month` is `Payment.periodMonth`
// decoded; a historical payment predating that field carries none.
export function describeMonthlyPeriod(
  monthlyFee: number | null,
  month: MonthKey | null,
  approvedAmounts: number[],
): string {
  if (month === null) return "Not assigned to a month yet";
  const status = monthStatus(monthlyFee, approvedAmounts);
  switch (status.kind) {
    case "unscored":
      return "Billed monthly";
    case "paid":
      return `${peso(status.paid)} paid for ${monthKeyLabel(month)}`;
    case "partial":
      return `${peso(status.paid)} paid for ${monthKeyLabel(month)} · ${peso(status.short)} still due`;
    case "unpaid":
      // `monthStatus` only returns "unpaid" when `monthlyFee` is not null -
      // a null fee returns "unscored" above, before this is reached.
      return `${peso(monthlyFee as number)} due for ${monthKeyLabel(month)}`;
  }
}

// Describes an enrollment's overall monthly standing: every month it owes,
// from enrollment through today (or through completion/removal), collapsed
// to one line naming the oldest month(s) still outstanding. Mirrors
// `selectableMonths`' signature, which already answers a related question
// from the same shape of inputs.
export function describeMonthlyStanding(
  enrollment: {
    enrolledAt: Date;
    completedAt: Date | null;
    removedAt: Date | null;
    course: { tuitionFee: number | null };
  },
  payments: MatrixPayment[],
  now: Date,
): string {
  const fee = enrollment.course.tuitionFee;
  if (fee === null) return "Billed monthly";

  const owed = monthsOwed(
    enrollment.enrolledAt,
    enrollment.removedAt ?? enrollment.completedAt,
    now,
  );
  // Only reachable for an enrollment dated after `now`, which real callers
  // never pass. Nothing to state either way.
  if (owed.length === 0) return "Billed monthly";

  const approvedByMonth = new Map<MonthKey, number[]>();
  for (const p of payments) {
    if (p.status !== "APPROVED" || p.periodMonth === null) continue;
    const bucket = approvedByMonth.get(p.periodMonth);
    if (bucket) bucket.push(p.amount);
    else approvedByMonth.set(p.periodMonth, [p.amount]);
  }

  const outstanding = owed
    .map((month) => ({
      month,
      status: monthStatus(fee, approvedByMonth.get(month) ?? []),
    }))
    .filter(
      (
        m,
      ): m is {
        month: MonthKey;
        status: Extract<MonthStatus, { kind: "unpaid" | "partial" }>;
      } => m.status.kind === "unpaid" || m.status.kind === "partial",
    );

  if (outstanding.length === 0) {
    // Every owed month is paid, so the last owed month - the most recent one
    // - is the latest one actually settled.
    return `Paid up through ${monthKeyLabel(owed[owed.length - 1])}`;
  }

  if (outstanding.length === 1) {
    const { month, status } = outstanding[0];
    if (status.kind === "partial") {
      return `${peso(status.paid)} paid for ${monthKeyLabel(month)} · ${peso(status.short)} still due`;
    }
    return `${peso(fee)} due for ${monthKeyLabel(month)}`;
  }

  const dueCentavos = outstanding.reduce((sum, { status }) => {
    const short = status.kind === "partial" ? status.short : fee;
    return sum + Math.round(short * 100);
  }, 0);
  const amountDue = dueCentavos / 100;

  if (outstanding.length === 2) {
    return `${peso(amountDue)} due for ${joinMonthNames(outstanding[0].month, outstanding[1].month)}`;
  }

  return `${peso(amountDue)} due for ${outstanding.length} months`;
}
