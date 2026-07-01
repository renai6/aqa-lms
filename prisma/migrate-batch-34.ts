import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DIRECT_URL
if (!connectionString) throw new Error('DIRECT_URL environment variable is not set')

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

async function main() {
  // NOTE: This script was run once to migrate data before lesson URL fields were removed.
  // lesson.materialUrl and lesson.recordingUrl no longer exist on the Lesson model.
  // Re-running this script will only ensure Batch 34 exists and enrollments are assigned.
  const courses = await db.course.findMany({
    where: { enrollments: { some: {} } },
    select: { id: true },
  })

  console.log(`Found ${courses.length} courses with enrollments.`)

  for (const course of courses) {
    const batch = await db.batch.upsert({
      where: { courseId_number: { courseId: course.id, number: 34 } },
      create: { courseId: course.id, number: 34, isActive: true },
      update: { isActive: true },
    })
    console.log(`Batch 34 ready for course ${course.id} (batchId: ${batch.id})`)

    const updated = await db.enrollment.updateMany({
      where: { courseId: course.id, batchId: null },
      data: { batchId: batch.id },
    })
    console.log(`Assigned ${updated.count} enrollments to Batch 34`)
  }

  console.log('Migration complete.')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
