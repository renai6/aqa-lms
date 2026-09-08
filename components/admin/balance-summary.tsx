import { describeBalance, type Balance } from "@/lib/payments/balance";

export function BalanceSummary({
  balance,
  label = "Balance",
  monthly,
}: {
  balance: Balance;
  label?: string;
  // The enrollment's monthly standing line (from `describeMonthlyStanding`),
  // set only for a MONTHLY course. When set, this - not `balance` - is what
  // renders: `balance` may still carry a lifetime `totalDue` on a handful of
  // legacy rows, and a monthly course never reads one regardless of what is
  // stored. Required, not optional, so every call site has to decide
  // explicitly rather than silently falling through to the lifetime
  // `describeBalance` wording the way the "After approving" preview once did.
  monthly: string | null;
}) {
  const text = monthly ?? describeBalance(balance);

  const tone =
    monthly !== null
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

// Settled reads positive, outstanding (or nothing to score) reads amber - the
// same convention `describeBalance`'s tone follows, and the same
// string-matching convention `monthlyLine`'s other renderers use (the student
// add-payment page and dashboard each carry their own copy of this, since
// it's a display concern rather than billing logic).
function monthlyTone(line: string): string {
  if (line.startsWith("Paid up through")) return "text-green-700";
  if (line === "Billed monthly") return "text-muted-foreground";
  return "text-amber-600";
}
