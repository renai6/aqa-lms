import { db } from '@/lib/db'
import { ACTIVE_ENROLLMENT } from '@/lib/enrollments/active'
import { computeLockedLessons, type GatingLesson } from '@/lib/lessons/gating'

// Gate state for one lesson and one student, for server actions that do not
// already have the subject loaded. getStudentSubject computes the same thing
// from data it has already fetched rather than calling this.
export async function getLessonGateState(
  userId: string,
  lessonId: string,
): Promise<{ isLocked: boolean; hasGate: boolean } | null> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      subjectId: true,
      assessment: { select: { isPublished: true } },
      subject: { select: { course: { select: { sequentialLessons: true } } } },
    },
  })
  if (!lesson) return null

  const hasGate = lesson.assessment?.isPublished === true
  if (!lesson.subject.course.sequentialLessons) return { isLocked: false, hasGate }

  const lessons = await db.lesson.findMany({
    where: { subjectId: lesson.subjectId },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      order: true,
      assessment: { select: { id: true, isPublished: true, passingScore: true } },
    },
  })

  const [completions, attempts] = await Promise.all([
    db.lessonCompletion.findMany({
      where: { userId, lessonId: { in: lessons.map(l => l.id) } },
      select: { lessonId: true },
    }),
    db.assessmentAttempt.findMany({
      where: {
        userId,
        assessmentId: {
          in: lessons.flatMap(l => (l.assessment ? [l.assessment.id] : [])),
        },
      },
      select: { assessmentId: true, score: true },
    }),
  ])

  const completed = new Set(completions.map(c => c.lessonId))
  const scoresBy = new Map<string, (number | null)[]>()
  for (const a of attempts) {
    scoresBy.set(a.assessmentId, [...(scoresBy.get(a.assessmentId) ?? []), a.score])
  }

  const locked = computeLockedLessons(
    lessons.map(l => ({
      id: l.id,
      order: l.order,
      isCompleted: completed.has(l.id),
      assessment: l.assessment
        ? {
            isPublished: l.assessment.isPublished,
            passingScore: l.assessment.passingScore,
            attemptScores: scoresBy.get(l.assessment.id) ?? [],
          }
        : null,
    })),
    true,
  )

  return { isLocked: locked.has(lessonId), hasGate }
}

// How many currently enrolled students would have at least one lesson locked
// if gating were switched on for this course right now. Shown in the admin
// confirmation so the rollout failure mode - throwing a live batch back to
// lesson one - is visible before it happens rather than through support
// messages.
export async function countStudentsAffectedByGating(courseId: string): Promise<number> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      subjects: {
        select: {
          lessons: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              order: true,
              assessment: {
                select: { id: true, isPublished: true, passingScore: true },
              },
            },
          },
        },
      },
    },
  })
  if (!course) return 0

  const enrollments = await db.enrollment.findMany({
    where: { courseId, ...ACTIVE_ENROLLMENT },
    select: { userId: true },
  })
  const userIds = enrollments.map(e => e.userId)
  if (userIds.length === 0) return 0

  const lessonIds = course.subjects.flatMap(s => s.lessons.map(l => l.id))
  const assessmentIds = course.subjects.flatMap(s =>
    s.lessons.flatMap(l => (l.assessment ? [l.assessment.id] : [])),
  )

  const [completions, attempts] = await Promise.all([
    lessonIds.length > 0
      ? db.lessonCompletion.findMany({
          where: { userId: { in: userIds }, lessonId: { in: lessonIds } },
          select: { userId: true, lessonId: true },
        })
      : Promise.resolve([]),
    assessmentIds.length > 0
      ? db.assessmentAttempt.findMany({
          where: { userId: { in: userIds }, assessmentId: { in: assessmentIds } },
          select: { userId: true, assessmentId: true, score: true },
        })
      : Promise.resolve([]),
  ])

  const completedBy = new Set(completions.map(c => c.userId + ':' + c.lessonId))
  const scoresBy = new Map<string, (number | null)[]>()
  for (const a of attempts) {
    const key = a.userId + ':' + a.assessmentId
    scoresBy.set(key, [...(scoresBy.get(key) ?? []), a.score])
  }

  let affected = 0
  for (const userId of userIds) {
    const locked = course.subjects.some(subject => {
      const lessons: GatingLesson[] = subject.lessons.map(l => ({
        id: l.id,
        order: l.order,
        isCompleted: completedBy.has(userId + ':' + l.id),
        assessment: l.assessment
          ? {
              isPublished: l.assessment.isPublished,
              passingScore: l.assessment.passingScore,
              attemptScores: scoresBy.get(userId + ':' + l.assessment.id) ?? [],
            }
          : null,
      }))
      return computeLockedLessons(lessons, true).size > 0
    })
    if (locked) affected += 1
  }

  return affected
}
