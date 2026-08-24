// The one place a balance is computed. Every admin and student surface calls
// this rather than doing its own arithmetic, so they cannot disagree.
export type Balance =
  | { kind: "untracked" }
  | { kind: "tracked"; totalDue: number; paid: number; remaining: number };

// `approvedAmounts` must already be filtered to APPROVED rows. Pending and
// rejected payments are not money received and never move a balance.
export function computeBalance(
  totalDue: number | null,
  approvedAmounts: number[],
): Balance {
  if (totalDue === null) return { kind: "untracked" };
  // Integer-centavo arithmetic, the same treatment `allocate` got in
  // 0f631e2: summing floats and comparing to 0 leaves residuals like
  // 3.64e-12 on splits that settle exactly, which renders as a permanent
  // "remaining" balance instead of "fully paid".
  const paidCentavos = approvedAmounts.reduce(
    (sum, amount) => sum + Math.round(amount * 100),
    0,
  );
  const totalDueCentavos = Math.round(totalDue * 100);
  const paid = paidCentavos / 100;
  // Deliberately not clamped at zero: an overpayment needs to be visible.
  const remaining = (totalDueCentavos - paidCentavos) / 100;
  return { kind: "tracked", totalDue, paid, remaining };
}

export function describeBalance(balance: Balance): string {
  if (balance.kind === "untracked") return "Balance not tracked";
  const { totalDue, paid, remaining } = balance;
  if (remaining < 0) return `Overpaid by ${peso(-remaining)}.`;
  if (remaining === 0) return `Fully paid. ${peso(paid)} of ${peso(totalDue)}.`;
  return `${peso(paid)} of ${peso(totalDue)} paid. ${peso(remaining)} remaining.`;
}

function peso(amount: number): string {
  return `₱${amount.toLocaleString("en-PH")}`;
}
