type QuestionForValidation = {
  type: string
  options: { isCorrect: boolean }[]
}

// A lesson gate has two rules a subject-level assessment does not: it must
// have a threshold to compare against, and it must score without a human,
// because a student is waiting on it to open the next lesson.
export type GateContext = { isGate: boolean; passingScore: number | null }

const NOT_A_GATE: GateContext = { isGate: false, passingScore: null }

export function getPublishBlockers(
  questions: QuestionForValidation[],
  gate: GateContext = NOT_A_GATE,
): string[] {
  if (questions.length === 0) return ['Assessment must have at least one question.']
  const blockers: string[] = []

  if (gate.isGate && gate.passingScore == null) {
    blockers.push('A lesson gate must have a passing score.')
  }

  questions.forEach((q, i) => {
    const num = i + 1
    if (q.type === 'MULTIPLE_CHOICE') {
      if (q.options.length < 2 || q.options.length > 6) {
        blockers.push(`Question ${num}: must have 2-6 options.`)
      }
      const correctCount = q.options.filter(o => o.isCorrect).length
      if (correctCount !== 1) {
        blockers.push(`Question ${num}: must have exactly one correct answer.`)
      }
    } else if (q.type === 'TRUE_FALSE') {
      const correctCount = q.options.filter(o => o.isCorrect).length
      if (correctCount !== 1) {
        blockers.push(`Question ${num}: must have a correct answer set.`)
      }
    } else if (q.type === 'ESSAY' && gate.isGate) {
      blockers.push(
        `Question ${num}: a lesson gate cannot contain essay questions, because it must score instantly.`,
      )
    }
  })

  return blockers
}
