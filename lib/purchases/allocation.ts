// Splits one purchase's amountPaid across its courses, so each resulting
// enrollment gets its own share of the money as a ledger row.
//
// This is a prefill for an admin-editable form, not a claim about which course
// the student meant the money for. The admin overrides it when a student
// earmarks payment for one course.
//
// The shares always sum to exactly `amountPaid`: the approval action validates
// that, so a split that lost a centavo to rounding would block the approval it
// was meant to prefill.
export function allocate(amountPaid: number, fees: (number | null)[]): number[] {
  if (fees.length === 0) return [];

  const total = fees.reduce<number>((sum, fee) => sum + (fee ?? 0), 0);
  // Proportional needs every fee known and a non-zero total to divide by.
  // Otherwise there is no basis for weighting, so weight them equally.
  const canWeight = fees.every((fee) => fee !== null) && total > 0;

  const shares = fees.map((fee) =>
    round2(canWeight ? (amountPaid * (fee as number)) / total : amountPaid / fees.length),
  );

  // Rounding each share independently leaves a few centavos over or short.
  // Give the difference to the largest share, where it is proportionally
  // least visible, and the total reconciles exactly.
  const drift = round2(amountPaid - shares.reduce((a, b) => a + b, 0));
  if (drift !== 0) {
    const largest = shares.reduce(
      (best, share, i) => (share > shares[best] ? i : best),
      0,
    );
    shares[largest] = round2(shares[largest] + drift);
  }

  return shares;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
