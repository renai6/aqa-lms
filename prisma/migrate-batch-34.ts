import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DIRECT_URL
if (!connectionString) throw new Error('DIRECT_URL environment variable is not set')

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

async function main() {
  const courses = await db.course.findMany({
    where: { enrollments: { some: {} } },
    select: {
      id: true,
      subjects: {
        select: {
          lessons: {
            select: { id: true, materialUrl: true, recordingUrl: true },
          },
        },
      },
    },
  })

  console.log(`Found ${courses.length} courses with enrollments.`)

  for (const course of courses) {
    const batch = await db.batch.upsert({
      where: { courseId_number: { courseId: course.id, number: 34 } },
      create: { courseId: course.id, number: 34, isActive: true },
      update: { isActive: true },
    })
    console.log(`Batch 34 ready for course ${course.id} (batchId: ${batch.id})`)

    const lessons = course.subjects.flatMap(s => s.lessons)
    for (const lesson of lessons) {
      if (lesson.materialUrl || lesson.recordingUrl) {
        await db.batchLessonContent.upsert({
          where: { batchId_lessonId: { batchId: batch.id, lessonId: lesson.id } },
          create: {
            batchId: batch.id,
            lessonId: lesson.id,
            materialUrl: lesson.materialUrl,
            recordingUrl: lesson.recordingUrl,
          },
          update: {
            materialUrl: lesson.materialUrl,
            recordingUrl: lesson.recordingUrl,
          },
        })
      }
    }
    console.log(`Migrated ${lessons.length} lessons for batch ${batch.id}`)

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
