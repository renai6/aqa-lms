// What a student will actually see after being moved into a batch. A move
// carries their progress, grades and payments over untouched, but the lesson
// materials, recordings and videos come from the destination batch - so an
// admin needs to know before confirming whether that batch has any.
export function batchCoverageNote(covered: number, totalLessons: number): string | null {
  if (totalLessons === 0) return null
  if (covered === 0) {
    return 'This batch has no lesson materials yet, so the student will see none until you add them.'
  }
  if (covered >= totalLessons) {
    return totalLessons === 1
      ? 'This batch has materials for its 1 lesson.'
      : 'This batch has materials for all ' + totalLessons + ' lessons.'
  }
  return 'This batch has materials for ' + covered + ' of ' + totalLessons + ' lessons.'
}
