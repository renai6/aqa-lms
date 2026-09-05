import type { Prisma } from '@prisma/client'
import { nextBatchNumber } from './number'
import { generateBatchName } from './name'

// A student reaches lesson content only through their batch: `getStudentSubjectDetail`
// loads BatchLessonContent by `enrollment.batchId`, so an enrollment left with no
// batch shows "No materials available" on every lesson - no material, no video, no
// recording - and nothing ever backfills it. The batch therefore has to exist at the
// moment the enrollment is written, which means opening one when the course has none
// rather than storing null and hoping an admin notices.
//
// Two approvals racing on a course with no batch can both try to create the same
// number; the unique (courseId, number) index turns the loser into a rolled-back
// transaction the admin retries, which is the correct outcome - never two batches.
export async function ensureActiveBatchId(
  tx: Prisma.TransactionClient,
  courseId: string,
): Promise<string> {
  const active = await tx.batch.findFirst({
    where: { courseId, isActive: true },
    select: { id: true },
  })
  if (active) return active.id

  const { _max } = await tx.batch.aggregate({ where: { courseId }, _max: { number: true } })
  const course = await tx.course.findUnique({
    where: { id: courseId },
    select: { courseAlias: true },
  })
  const created = await tx.batch.create({
    data: {
      courseId,
      number: nextBatchNumber(_max.number),
      isActive: true,
      name: generateBatchName(course?.courseAlias ?? null, new Date()),
    },
    select: { id: true },
  })
  return created.id
}
