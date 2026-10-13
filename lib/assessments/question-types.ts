import type { QuestionType } from '@prisma/client'

export const QUESTION_TYPES = [
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'ESSAY',
  'FILE_UPLOAD',
] as const satisfies readonly QuestionType[]

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: 'Multiple Choice',
  TRUE_FALSE: 'True / False',
  ESSAY: 'Essay',
  FILE_UPLOAD: 'File Upload',
}

// Types a teacher scores by hand. They have no answer key, leave an attempt
// awaiting grading, and are barred from lesson gates, which must score instantly.
export const MANUALLY_GRADED_TYPES = ['ESSAY', 'FILE_UPLOAD'] as const satisfies readonly QuestionType[]

export function isManuallyGraded(type: string): boolean {
  return (MANUALLY_GRADED_TYPES as readonly string[]).includes(type)
}
