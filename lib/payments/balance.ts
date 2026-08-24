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
  const paid = approvedAmounts.reduce((sum, amount) => sum + amount, 0);
  // Deliberately not clamped at zero: an overpayment needs to be visible.
  return { kind: "tracked", totalDue, paid, remaining: totalDue - paid };
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
