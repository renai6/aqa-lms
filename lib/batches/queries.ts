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

export type BatchLesson = {
  id: string
  title: string
  order: number
  batchContent: Array<{ materialUrl: string | null; recordingUrl: string | null; videoUrl: string | null }>
}

export type BatchSubject = {
  id: string
  title: string
  order: number
  lessons: BatchLesson[]
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
                    select: { materialUrl: true, recordingUrl: true, videoUrl: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
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
