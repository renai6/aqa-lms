import { db } from '@/lib/db'
import { nextBatchNumber } from './number'

export type BatchRow = {
  id: string
  number: number
  name: string | null
  isActive: boolean
  createdAt: Date
  _count: { enrollments: number }
}

export async function getActiveBatch(
  courseId: string,
): Promise<{ id: string; number: number; name: string | null } | null> {
  return db.batch.findFirst({
    where: { courseId, isActive: true },
    select: { id: true, number: true, name: true },
  })
}

export async function getCourseBatches(courseId: string): Promise<BatchRow[]> {
  return db.batch.findMany({
    where: { courseId },
    orderBy: { number: 'desc' },
    select: {
      id: true,
      number: true,
      name: true,
      isActive: true,
      createdAt: true,
      _count: { select: { enrollments: true } },
    },
  })
}

export type BatchLessonContentRow = {
  materialUrl: string | null
  videoUrl: string | null
  audioUrl: string | null
  pptUrl: string | null
}

export type BatchLesson = {
  id: string
  title: string
  order: number
  batchContent: BatchLessonContentRow[]
}

export type BatchRecordingRow = {
  id: string
  url: string
  date: Date
  title: string | null
}

export type BatchSubject = {
  id: string
  title: string
  order: number
  lessons: BatchLesson[]
  recordings: BatchRecordingRow[]
}

export type BatchDetail = {
  id: string
  number: number
  name: string | null
  isActive: boolean
  courseId: string
  _count: { enrollments: number }
  course: { subjects: BatchSubject[] }
}

export async function getBatchDetail(batchId: string): Promise<BatchDetail | null> {
  return db.batch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      number: true,
      name: true,
      isActive: true,
      courseId: true,
      _count: { select: { enrollments: true } },
      course: {
        select: {
          subjects: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              title: true,
              order: true,
              lessons: {
                orderBy: { order: 'asc' },
                select: {
                  id: true,
                  title: true,
                  order: true,
                  batchContent: {
                    where: { batchId },
                    select: {
                      materialUrl: true,
                      videoUrl: true,
                      audioUrl: true,
                      pptUrl: true,
                    },
                  },
                },
              },
              recordings: {
                where: { batchId },
                orderBy: { date: 'desc' },
                select: { id: true, url: true, date: true, title: true },
              },
            },
          },
        },
      },
    },
  })
}

// How much lesson content each batch of the course actually carries, so an
// admin moving a student can see what the destination batch will show them.
// A BatchLessonContent row with all three URLs cleared is not content, which
// is why this counts lessons rather than rows.
export type BatchContentCoverage = {
  totalLessons: number
  byBatch: Record<string, number>
}

export async function getBatchContentCoverage(
  courseId: string,
): Promise<BatchContentCoverage> {
  const [totalLessons, grouped] = await Promise.all([
    db.lesson.count({ where: { subject: { courseId } } }),
    db.batchLessonContent.groupBy({
      by: ['batchId'],
      where: {
        batch: { courseId },
        OR: [
          { materialUrl: { not: null } },
          { videoUrl: { not: null } },
          { audioUrl: { not: null } },
          { pptUrl: { not: null } },
        ],
      },
      _count: { _all: true },
    }),
  ])

  const byBatch: Record<string, number> = {}
  for (const row of grouped) byBatch[row.batchId] = row._count._all

  return { totalLessons, byBatch }
}

export async function getMaxBatchNumber(courseId: string): Promise<number | null> {
  const result = await db.batch.aggregate({
    where: { courseId },
    _max: { number: true },
  })
  return result._max.number
}

export { nextBatchNumber }
export { batchLabel } from './name'
