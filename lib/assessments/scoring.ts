import type { QuestionType, AttemptStatus } from '@prisma/client'

// Pure auto-scoring logic for a submitted attempt.
// Objective questions (MULTIPLE_CHOICE, TRUE_FALSE) are scored against the
// option flagged isCorrect. Essays are left ungraded (null) for a later
// teacher-grading slice.

export type ScorableOption = {
  value: string
  isCorrect: boolean
}

export type ScorableQuestion = {
  id: string
  type: QuestionType
  points: number
  options: ScorableOption[]
}

export type SubmittedAnswer = {
  questionId: string
  answer: string
}

export type ScoredAnswer = {
  questionId: string
  answer: string
  isCorrect: boolean | null
  pointsEarned: number | null
}

export type ScoredAttempt = {
  answers: ScoredAnswer[]
  hasEssay: boolean
  totalPoints: number
  earnedPoints: number
  // Percentage 0-100, or null when the attempt awaits essay grading.
  score: number | null
  status: AttemptStatus
}

export function scoreOneAnswer(
  question: ScorableQuestion,
  answer: string,
): { isCorrect: boolean | null; pointsEarned: number | null } {
  if (question.type === 'ESSAY') {
    return { isCorrect: null, pointsEarned: null }
  }
  const correct = question.options.find(o => o.isCorrect)
  const isCorrect = correct != null && answer === correct.value
  return { isCorrect, pointsEarned: isCorrect ? question.points : 0 }
}

export function scoreAttempt(
  questions: ScorableQuestion[],
  submitted: SubmittedAnswer[],
): ScoredAttempt {
  const answerMap = new Map(submitted.map(s => [s.questionId, s.answer]))

  let hasEssay = false
  let totalPoints = 0
  let earnedPoints = 0

  const answers: ScoredAnswer[] = questions.map(q => {
    totalPoints += q.points
    const raw = answerMap.get(q.id) ?? ''
    if (q.type === 'ESSAY') hasEssay = true
    const { isCorrect, pointsEarned } = scoreOneAnswer(q, raw)
    if (pointsEarned != null) earnedPoints += pointsEarned
    return { questionId: q.id, answer: raw, isCorrect, pointsEarned }
  })

  const score = hasEssay
    ? null
    : totalPoints > 0
      ? (earnedPoints / totalPoints) * 100
      : 0

  return {
    answers,
    hasEssay,
    totalPoints,
    earnedPoints,
    score,
    status: hasEssay ? 'SUBMITTED' : 'GRADED',
  }
}
