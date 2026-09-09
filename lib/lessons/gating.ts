// Pure unlock rule for per-lesson assessment gating. No DB access and no
// Prisma imports, so it is unit testable and can be called from a query that
// has already loaded the data it needs.

export type GateAssessment = {
  isPublished: boolean
  passingScore: number | null
  // Every score this student has recorded on the gate. Null entries are
  // attempts awaiting grading, which never satisfy a gate.
  attemptScores: (number | null)[]
}

export type GatingLesson = {
  id: string
  order: number
  // A LessonCompletion row exists for this student. It is written both by the
  // manual "Mark as done" button and by passing a gate, which is what makes
  // students who progressed before gating existed keep their access.
  isCompleted: boolean
  assessment: GateAssessment | null
}

// Every failure mode here resolves to satisfied. A broken or half-configured
// gate must never leave a paying student unable to study.
export function isLessonSatisfied(lesson: GatingLesson): boolean {
  const gate = lesson.assessment
  if (gate == null) return true
  if (!gate.isPublished) return true
  if (gate.passingScore == null) return true
  if (lesson.isCompleted) return true
  return gate.attemptScores.some(s => s != null && s >= gate.passingScore!)
}

// Maps each locked lesson id to the id of the lesson blocking it. The first
// unsatisfied lesson stays open, because the student has to reach it to take
// the quiz that unlocks the rest.
export function computeLockedLessons(
  lessons: GatingLesson[],
  sequentialLessons: boolean,
): Map<string, string> {
  const locked = new Map<string, string>()
  if (!sequentialLessons) return locked

  const ordered = [...lessons].sort((a, b) => a.order - b.order)
  let blockedBy: string | null = null

  for (const lesson of ordered) {
    if (blockedBy != null) {
      locked.set(lesson.id, blockedBy)
      continue
    }
    if (!isLessonSatisfied(lesson)) blockedBy = lesson.id
  }

  return locked
}
