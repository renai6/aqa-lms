type QuestionForValidation = {
  type: string
  options: { isCorrect: boolean }[]
}

export function getPublishBlockers(questions: QuestionForValidation[]): string[] {
  if (questions.length === 0) return ['Assessment must have at least one question.']
  const blockers: string[] = []
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
    }
  })
  return blockers
}
