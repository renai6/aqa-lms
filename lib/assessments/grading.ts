import type { AttemptStatus } from '@prisma/client'

// One relevant attempt per assessment: prefer a completed (non-in-progress)
// attempt over an in-progress one, otherwise the most recent. The caller is
// expected to pass attempts already ordered most-recent-first.
// Shared by the student course/subject views and the teacher gradebook so every
// surface agrees on which attempt "counts".
export function pickRelevantAttempt<T extends { status: AttemptStatus }>(
  attempts: T[],
): T | null {
  return attempts.find((a) => a.status !== 'IN_PROGRESS') ?? attempts[0] ?? null
}

export type AttemptQuestion = { id: string; points: number }

// Recompute an attempt's percentage score (0-100) from the points earned on
// every question. Objective points are stored at submit time; essay points are
// added by the teacher at grading time. Missing entries count as 0.
export function recomputeAttemptScore(
  questions: AttemptQuestion[],
  pointsEarnedById: Map<string, number>,
): number {
  let total = 0
  let earned = 0
  for (const q of questions) {
    total += q.points
    earned += pointsEarnedById.get(q.id) ?? 0
  }
  return total > 0 ? (earned / total) * 100 : 0
}
