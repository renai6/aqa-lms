export function nextBatchNumber(maxExisting: number | null): number {
  return (maxExisting ?? 33) + 1
}
