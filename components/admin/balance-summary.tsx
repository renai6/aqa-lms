import { describeBalance, type Balance } from "@/lib/payments/balance";
import { describeMonthlyPeriod, monthStatus } from "@/lib/payments/monthly";
import type { MonthKey } from "@/lib/time/manila";

// Present only for a MONTHLY course. `month` is the specific month this
// summary describes (a payment's `periodMonth`), null if that payment
// predates the field or was never assigned one.
type MonthlyInfo = {
  fee: number | null;
  month: MonthKey | null;
  approvedAmounts: number[];
};

export function BalanceSummary({
  balance,
  label = "Balance",
  monthly = null,
}: {
  balance: Balance;
  label?: string;
  monthly?: MonthlyInfo | null;
}) {
  // A monthly course never reads its lifetime `balance` here - not even when
  // a legacy row still carries a `totalDue` it should not have. The course
  // being MONTHLY is what decides which line renders, not what happens to be
  // stored.
  const text = monthly
    ? describeMonthlyPeriod(monthly.fee, monthly.month, monthly.approvedAmounts)
    : describeBalance(balance);

  const tone = monthly
    ? monthlyTone(monthly)
    : balance.kind === "untracked"
      ? "text-muted-foreground"
      : balance.remaining > 0
        ? "text-amber-600"
        : balance.remaining < 0
          ? "text-destructive"
          : "text-green-700";

  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${tone}`}>{text}</span>
    </div>
  );
}

// Settled reads positive (green), outstanding reads amber - same convention
// `describeBalance`'s tone follows. A month with nothing to verdict on
// (unassigned, or no tuitionFee) reads muted/amber the way "Balance not
// tracked" and "Not assigned to a month" already do elsewhere on this page.
function monthlyTone(monthly: MonthlyInfo): string {
  if (monthly.month === null) return "text-amber-600";
  if (monthly.fee === null) return "text-muted-foreground";
  const status = monthStatus(monthly.fee, monthly.approvedAmounts);
  return status.kind === "paid" ? "text-green-700" : "text-amber-600";
}
