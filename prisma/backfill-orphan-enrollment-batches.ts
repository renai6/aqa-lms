import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { ensureActiveBatchId } from '../lib/batches/ensure'

// Enrollments approved before `ensureActiveBatchId` existed could be written with
// `batchId: null` whenever their course had no active batch. A student in that
// state reads no lesson content at all - `getStudentSubjectDetail` looks
// BatchLessonContent up by `enrollment.batchId` - and nothing backfilled it, so
// every lesson showed "No materials available" indefinitely.
//
// This assigns each orphan to its course's active batch, opening one where the
// course has none. Removed enrollments are included: they keep their slot and can
// be revived, and a revived orphan is the same bug again.
//
// Dry run by default. Pass --apply to write.

const connectionString = process.env.DIRECT_URL
if (!connectionString) throw new Error('DIRECT_URL environment variable is not set')

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
const apply = process.argv.includes('--apply')

async function main() {
  const orphans = await db.enrollment.findMany({
    where: { batchId: null },
    select: {
      id: true,
      courseId: true,
      removedAt: true,
      course: { select: { title: true } },
      user: { select: { email: true } },
    },
  })

  console.log(`${orphans.length} enrollment(s) with no batch.`)
  if (orphans.length === 0) return

  const byCourse = new Map<string, typeof orphans>()
  for (const e of orphans) {
    const list = byCourse.get(e.courseId) ?? []
    list.push(e)
    byCourse.set(e.courseId, list)
  }

  for (const [courseId, list] of byCourse) {
    const active = await db.batch.findFirst({
      where: { courseId, isActive: true },
      select: { id: true, number: true },
    })
    const target = active ? `Batch ${active.number}` : 'a new batch (none active)'
    console.log(`\n${list[0].course.title} - ${list.length} orphan(s) -> ${target}`)
    for (const e of list) {
      console.log(`  ${e.user.email}${e.removedAt ? ' (removed)' : ''}`)
    }

    if (!apply) continue

    // One transaction per course so the batch it opens and the assignments that
    // depend on it commit together.
    await db.$transaction(async (tx) => {
      const batchId = await ensureActiveBatchId(tx, courseId)
      const updated = await tx.enrollment.updateMany({
        where: { id: { in: list.map(e => e.id) } },
        data: { batchId },
      })
      console.log(`  assigned ${updated.count} to batch ${batchId}`)
    })
  }

  if (!apply) console.log('\nDry run. Re-run with --apply to write.')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
