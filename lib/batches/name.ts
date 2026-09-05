// A batch's display name: the month and year it opened, followed by the
// course's alias - "0926MM01" for a September 2026 batch of course MM01.
//
// The name is a snapshot written at creation, never derived at render: an
// admin editing the alias later must not silently rewrite the label on
// batches that have already run.
//
// Vercel runs in UTC while the academy runs on Philippine time, so the month
// has to come from the admin's own calendar - a batch opened at 00:30 on
// 1 October in Manila is still 30 September in UTC.
const MANILA_MONTH_YEAR = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  year: '2-digit',
  month: '2-digit',
})

export function generateBatchName(courseAlias: string | null, at: Date): string | null {
  const alias = courseAlias?.trim()
  if (!alias) return null

  const parts = MANILA_MONTH_YEAR.formatToParts(at)
  const month = parts.find((p) => p.type === 'month')?.value
  const year = parts.find((p) => p.type === 'year')?.value
  if (!month || !year) return null

  return month + year + alias
}

// Courses with no alias - every course predating the field - keep the
// original numbered label.
export function batchLabel(batch: { name: string | null; number: number }): string {
  return batch.name ?? 'Batch ' + batch.number
}
