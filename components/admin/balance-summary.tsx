import { describeBalance, type Balance } from "@/lib/payments/balance";

export function BalanceSummary({
  balance,
  label = "Balance",
}: {
  balance: Balance;
  label?: string;
}) {
  const tone =
    balance.kind === "untracked"
      ? "text-muted-foreground"
      : balance.remaining > 0
        ? "text-amber-600"
        : balance.remaining < 0
          ? "text-destructive"
          : "text-green-700";

  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${tone}`}>{describeBalance(balance)}</span>
    </div>
  );
}
