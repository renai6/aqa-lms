import { db } from '@/lib/db'
import type { AssessmentType, QuestionType } from '@prisma/client'

export type AssessmentRow = {
  id: string
  title: string
  type: AssessmentType
  isPublished: boolean
  durationMins: number | null
  passingScore: number | null
  maxAttempts: number | null
  weight: number
  questionCount: number
  totalPoints: number
  attemptCount: number
}

export async function getSubjectAssessments(subjectId: string): Promise<AssessmentRow[]> {
  const rows = await db.assessment.findMany({
    where: { subjectId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      title: true,
      type: true,
      isPublished: true,
      durationMins: true,
      passingScore: true,
      maxAttempts: true,
      weight: true,
      questions: { select: { points: true } },
      _count: { select: { attempts: true } },
    },
  })
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    type: r.type,
    isPublished: r.isPublished,
    durationMins: r.durationMins,
    passingScore: r.passingScore,
    maxAttempts: r.maxAttempts,
    weight: r.weight,
    questionCount: r.questions.length,
    totalPoints: r.questions.reduce((sum, q) => sum + q.points, 0),
    attemptCount: r._count.attempts,
  }))
}

export type QuestionOptionRow = {
  id: string
  label: string
  value: string
  isCorrect: boolean
}

export type QuestionRow = {
  id: string
  questionText: string
  type: QuestionType
  points: number
  order: number
  options: QuestionOptionRow[]
}

export type AssessmentDetail = {
  id: string
  title: string
  type: AssessmentType
  isPublished: boolean
  durationMins: number | null
  passingScore: number | null
  maxAttempts: number | null
  weight: number
  subjectId: string
  subject: { id: string; title: string; courseId: string; course: { title: string } }
  questions: QuestionRow[]
  attemptCount: number
}

export async function getAssessmentById(aid: string): Promise<AssessmentDetail | null> {
  const row = await db.assessment.findUnique({
    where: { id: aid },
    select: {
      id: true,
      title: true,
      type: true,
      isPublished: true,
      durationMins: true,
      passingScore: true,
      maxAttempts: true,
      weight: true,
      subjectId: true,
      subject: {
        select: {
          id: true,
          title: true,
          courseId: true,
          course: { select: { title: true } },
        },
      },
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
      _count: { select: { attempts: true } },
    },
  })
  if (!row) return null
  return { ...row, attemptCount: row._count.attempts }
}

export type QuestionDetail = {
  id: string
  assessmentId: string
  questionText: string
  type: QuestionType
  points: number
  order: number
  options: QuestionOptionRow[]
  assessment: {
    id: string
    title: string
    subjectId: string
    subject: { courseId: string; title: string; course: { title: string } }
    attemptCount: number
  }
}

export async function getQuestionById(qid: string): Promise<QuestionDetail | null> {
  const row = await db.question.findUnique({
    where: { id: qid },
    select: {
      id: true,
      assessmentId: true,
      questionText: true,
      type: true,
      points: true,
      order: true,
      options: {
        select: { id: true, label: true, value: true, isCorrect: true },
      },
      assessment: {
        select: {
          id: true,
          title: true,
          subjectId: true,
          _count: { select: { attempts: true } },
          subject: {
            select: {
              courseId: true,
              title: true,
              course: { select: { title: true } },
            },
          },
        },
      },
    },
  })
  if (!row) return null
  return {
    ...row,
    assessment: {
      id: row.assessment.id,
      title: row.assessment.title,
      subjectId: row.assessment.subjectId,
      attemptCount: row.assessment._count.attempts,
      subject: row.assessment.subject,
    },
  }
}
