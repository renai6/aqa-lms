// lib/teacher/queries.ts
import { db } from '@/lib/db'
import type {
  AssessmentType,
  AttemptStatus,
  QuestionType,
} from '@prisma/client'
import { pickRelevantAttempt } from '@/lib/assessments/grading'
import { weightedSubjectGrade } from '@/lib/grades/compute'
import { enrolleeGenderWhere } from '@/lib/subjects/visibility'
import { ACTIVE_ENROLLMENT } from '@/lib/enrollments/active'

// All queries here are scoped to the teacher's assigned subjects via the
// SubjectTeacher join. A helper checks assignment; callers return notFound()
// when a query returns null.

async function isAssigned(userId: string, subjectId: string): Promise<boolean> {
  const row = await db.subjectTeacher.findUnique({
    where: { subjectId_userId: { subjectId, userId } },
    select: { subjectId: true },
  })
  return row != null
}

// ─── My Subjects list ─────────────────────────────────────────────────────────

export type TeacherSubjectRow = {
  id: string
  title: string
  courseId: string
  courseTitle: string
  studentCount: number
  assessmentCount: number
  pendingGrading: number
}

export async function getTeacherSubjects(
  userId: string,
): Promise<TeacherSubjectRow[]> {
  const assignments = await db.subjectTeacher.findMany({
    where: { userId },
    orderBy: { assignedAt: 'desc' },
    select: {
      subject: {
        select: {
          id: true,
          courseId: true,
          title: true,
          gender: true,
          course: { select: { title: true } },
          _count: { select: { assessments: true } },
        },
      },
    },
  })

  return Promise.all(
    assignments.map(async ({ subject }) => {
      const [studentCount, pendingGrading] = await Promise.all([
        // Count only enrollees who can actually see this (possibly gendered)
        // subject, so the roster count matches who participates (D5).
        db.enrollment.count({
          where: {
            courseId: subject.courseId,
            ...ACTIVE_ENROLLMENT,
            ...enrolleeGenderWhere(subject.gender),
          },
        }),
        db.assessmentAttempt.count({
          where: { status: 'SUBMITTED', assessment: { subjectId: subject.id } },
        }),
      ])
      return {
        id: subject.id,
        title: subject.title,
        courseId: subject.courseId,
        courseTitle: subject.course.title,
        studentCount,
        assessmentCount: subject._count.assessments,
        pendingGrading,
      }
    }),
  )
}

export async function countTeacherPendingGrading(
  userId: string,
): Promise<number> {
  return db.assessmentAttempt.count({
    where: {
      status: 'SUBMITTED',
      assessment: { subject: { teachers: { some: { userId } } } },
    },
  })
}

// ─── Subject detail ───────────────────────────────────────────────────────────

export type TeacherSubjectDetail = {
  id: string
  title: string
  description: string | null
  courseId: string
  courseTitle: string
  passingGrade: number
  assessments: Array<{
    id: string
    title: string
    type: AssessmentType
    isPublished: boolean
    weight: number
    questionCount: number
    attemptCount: number
    pendingGrading: number
  }>
}

export async function getTeacherSubject(
  userId: string,
  subjectId: string,
): Promise<TeacherSubjectDetail | null> {
  if (!(await isAssigned(userId, subjectId))) return null

  const subject = await db.subject.findUnique({
    where: { id: subjectId },
    select: {
      id: true,
      title: true,
      description: true,
      courseId: true,
      course: { select: { title: true, passingGrade: true } },
      assessments: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          title: true,
          type: true,
          isPublished: true,
          weight: true,
          _count: { select: { questions: true, attempts: true } },
          attempts: { where: { status: 'SUBMITTED' }, select: { id: true } },
        },
      },
    },
  })
  if (!subject) return null

  return {
    id: subject.id,
    title: subject.title,
    description: subject.description,
    courseId: subject.courseId,
    courseTitle: subject.course.title,
    passingGrade: subject.course.passingGrade,
    assessments: subject.assessments.map((a) => ({
      id: a.id,
      title: a.title,
      type: a.type,
      isPublished: a.isPublished,
      weight: a.weight,
      questionCount: a._count.questions,
      attemptCount: a._count.attempts,
      pendingGrading: a.attempts.length,
    })),
  }
}

// ─── Students of a subject (all course enrollees) ─────────────────────────────

export type SubjectStudentRow = {
  id: string
  firstName: string
  lastName: string
  email: string
  enrolledAt: Date
}

export async function getSubjectStudents(
  subjectId: string,
): Promise<SubjectStudentRow[]> {
  const subject = await db.subject.findUnique({
    where: { id: subjectId },
    select: { courseId: true, gender: true },
  })
  if (!subject) return []

  const enrollments = await db.enrollment.findMany({
    where: {
            courseId: subject.courseId,
            ...ACTIVE_ENROLLMENT,
            ...enrolleeGenderWhere(subject.gender),
          },
    orderBy: { user: { lastName: 'asc' } },
    select: {
      enrolledAt: true,
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  })

  return enrollments.map((e) => ({
    id: e.user.id,
    firstName: e.user.firstName,
    lastName: e.user.lastName,
    email: e.user.email,
    enrolledAt: e.enrolledAt,
  }))
}

// ─── Grading queue for one assessment ─────────────────────────────────────────

export type GradingQueueAttempt = {
  attemptId: string
  studentId: string
  studentName: string
  status: AttemptStatus
  score: number | null
  submittedAt: Date | null
}

export type AssessmentGradingQueue = {
  assessmentId: string
  title: string
  subjectId: string
  hasEssay: boolean
  attempts: GradingQueueAttempt[]
}

export async function getAssessmentGradingQueue(
  assessmentId: string,
): Promise<AssessmentGradingQueue | null> {
  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      title: true,
      subjectId: true,
      questions: { select: { type: true } },
      attempts: {
        where: { status: { in: ['SUBMITTED', 'GRADED'] } },
        orderBy: [{ status: 'asc' }, { submittedAt: 'asc' }],
        select: {
          id: true,
          status: true,
          score: true,
          submittedAt: true,
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  })
  if (!assessment) return null

  return {
    assessmentId: assessment.id,
    title: assessment.title,
    subjectId: assessment.subjectId,
    hasEssay: assessment.questions.some((q) => q.type === 'ESSAY'),
    attempts: assessment.attempts.map((a) => ({
      attemptId: a.id,
      studentId: a.user.id,
      studentName: a.user.firstName + ' ' + a.user.lastName,
      status: a.status,
      score: a.score,
      submittedAt: a.submittedAt,
    })),
  }
}

// ─── One attempt, for grading ─────────────────────────────────────────────────

export type GradingQuestion = {
  id: string
  questionText: string
  type: QuestionType
  points: number
  order: number
  options: Array<{
    id: string
    label: string
    value: string
    isCorrect: boolean
  }>
  answer: string | null
  isCorrect: boolean | null
  pointsEarned: number | null
  feedback: string | null
}

export type AttemptForGrading = {
  id: string
  status: AttemptStatus
  score: number | null
  submittedAt: Date | null
  assessmentId: string
  assessmentTitle: string
  subjectId: string
  subjectTitle: string
  studentId: string
  studentName: string
  questions: GradingQuestion[]
}

export async function getAttemptForGrading(
  attemptId: string,
): Promise<AttemptForGrading | null> {
  const attempt = await db.assessmentAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      status: true,
      score: true,
      submittedAt: true,
      assessmentId: true,
      user: { select: { id: true, firstName: true, lastName: true } },
      assessment: {
        select: {
          title: true,
          subjectId: true,
          subject: { select: { title: true } },
          questions: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              questionText: true,
              type: true,
              points: true,
              order: true,
              options: {
                select: { id: true, label: true, value: true, isCorrect: true },
              },
            },
          },
        },
      },
      answers: {
        select: {
          questionId: true,
          answer: true,
          isCorrect: true,
          pointsEarned: true,
          feedback: true,
        },
      },
    },
  })
  if (!attempt) return null

  const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]))
  const questions = attempt.assessment.questions.map((q) => {
    const a = answerMap.get(q.id)
    return {
      id: q.id,
      questionText: q.questionText,
      type: q.type,
      points: q.points,
      order: q.order,
      options: q.options,
      answer: a?.answer ?? null,
      isCorrect: a?.isCorrect ?? null,
      pointsEarned: a?.pointsEarned ?? null,
      feedback: a?.feedback ?? null,
    }
  })

  return {
    id: attempt.id,
    status: attempt.status,
    score: attempt.score,
    submittedAt: attempt.submittedAt,
    assessmentId: attempt.assessmentId,
    assessmentTitle: attempt.assessment.title,
    subjectId: attempt.assessment.subjectId,
    subjectTitle: attempt.assessment.subject.title,
    studentId: attempt.user.id,
    studentName: attempt.user.firstName + ' ' + attempt.user.lastName,
    questions,
  }
}

// ─── Gradebook (students × assessments + final grades) ────────────────────────

export type GradebookAssessment = { id: string; title: string; weight: number }

export type GradebookStudent = {
  studentId: string
  studentName: string
  // Aligned to `assessments`: the relevant attempt's percentage, or null.
  scores: (number | null)[]
  suggestion: number | null
  savedGrade: number | null
  diverges: boolean
}

export type SubjectGradebook = {
  subjectId: string
  subjectTitle: string
  passingGrade: number
  assessments: GradebookAssessment[]
  students: GradebookStudent[]
}

// Round to 2 decimals for a stable saved-vs-suggestion comparison.
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function getSubjectGradebook(
  userId: string,
  subjectId: string,
): Promise<SubjectGradebook | null> {
  if (!(await isAssigned(userId, subjectId))) return null

  const subject = await db.subject.findUnique({
    where: { id: subjectId },
    select: {
      id: true,
      title: true,
      courseId: true,
      gender: true,
      course: { select: { passingGrade: true } },
      assessments: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, title: true, weight: true },
      },
    },
  })
  if (!subject) return null

  const [enrollments, grades] = await Promise.all([
    db.enrollment.findMany({
      where: {
            courseId: subject.courseId,
            ...ACTIVE_ENROLLMENT,
            ...enrolleeGenderWhere(subject.gender),
          },
      orderBy: { user: { lastName: 'asc' } },
      select: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    db.grade.findMany({
      where: { subjectId },
      select: { userId: true, finalGrade: true },
    }),
  ])

  const studentIds = enrollments.map((e) => e.user.id)
  const assessmentIds = subject.assessments.map((a) => a.id)

  const attempts =
    studentIds.length > 0 && assessmentIds.length > 0
      ? await db.assessmentAttempt.findMany({
          where: {
            userId: { in: studentIds },
            assessmentId: { in: assessmentIds },
          },
          orderBy: { startedAt: 'desc' },
          select: {
            userId: true,
            assessmentId: true,
            status: true,
            score: true,
          },
        })
      : []

  // Group attempts by (userId, assessmentId), already ordered most-recent-first.
  const attemptsByKey = new Map<
    string,
    { status: AttemptStatus; score: number | null }[]
  >()
  for (const a of attempts) {
    const key = a.userId + ':' + a.assessmentId
    const list = attemptsByKey.get(key) ?? []
    list.push({ status: a.status, score: a.score })
    attemptsByKey.set(key, list)
  }

  const gradeMap = new Map(grades.map((g) => [g.userId, g.finalGrade]))

  const students: GradebookStudent[] = enrollments.map(({ user }) => {
    const scores = subject.assessments.map((a) => {
      const list = attemptsByKey.get(user.id + ':' + a.id) ?? []
      return pickRelevantAttempt(list)?.score ?? null
    })
    const suggestion = weightedSubjectGrade(
      subject.assessments.map((a, i) => ({
        weight: a.weight,
        score: scores[i],
      })),
    )
    const savedGrade = gradeMap.get(user.id) ?? null
    const diverges =
      savedGrade != null &&
      suggestion != null &&
      round2(savedGrade) !== round2(suggestion)

    return {
      studentId: user.id,
      studentName: user.firstName + ' ' + user.lastName,
      scores,
      suggestion: suggestion != null ? round2(suggestion) : null,
      savedGrade,
      diverges,
    }
  })

  return {
    subjectId: subject.id,
    subjectTitle: subject.title,
    passingGrade: subject.course.passingGrade,
    assessments: subject.assessments.map((a) => ({
      id: a.id,
      title: a.title,
      weight: a.weight,
    })),
    students,
  }
}
