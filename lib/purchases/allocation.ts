// Splits one purchase's amountPaid across its courses, so each resulting
// enrollment gets its own share of the money as a ledger row.
//
// This is a prefill for an admin-editable form, not a claim about which course
// the student meant the money for. The admin overrides it when a student
// earmarks payment for one course.
//
// The shares reconcile to `amountPaid` at centavo precision: the approval
// action validates at that precision, so a split that loses a centavo to
// rounding would block the approval it was meant to prefill.
export function allocate(
  amountPaid: number,
  fees: (number | null)[],
): number[] {
  if (fees.length === 0) return [];

  // All arithmetic runs in integer centavos. Splitting in pesos and re-summing
  // the rounded shares reintroduces float error, which made the old "sums to
  // exactly amountPaid" claim false for about a quarter of realistic inputs.
  const target = Math.round(amountPaid * 100);
  const weights = fees.map((fee) => Math.round((fee ?? 0) * 100));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // Proportional needs every fee known and a non-zero total to divide by.
  // Otherwise there is no basis for weighting, so weight them equally.
  const canWeight = fees.every((fee) => fee !== null) && totalWeight > 0;

  const shares = weights.map((w) =>
    Math.round(canWeight ? (target * w) / totalWeight : target / fees.length),
  );

  // Rounding each share independently leaves a few centavos over or short.
  // Give the difference to the largest share, where it is proportionally
  // least visible, and the total reconciles exactly.
  const drift = target - shares.reduce((sum, s) => sum + s, 0);
  if (drift !== 0) {
    const largest = shares.reduce(
      (best, share, i) => (share > shares[best] ? i : best),
      0,
    );
    shares[largest] += drift;
  }

  return shares.map((s) => s / 100);
}
