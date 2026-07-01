-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "batchId" TEXT;

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchLessonContent" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "materialUrl" TEXT,
    "recordingUrl" TEXT,

    CONSTRAINT "BatchLessonContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Batch_courseId_idx" ON "Batch"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_courseId_number_key" ON "Batch"("courseId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "BatchLessonContent_batchId_lessonId_key" ON "BatchLessonContent"("batchId", "lessonId");

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchLessonContent" ADD CONSTRAINT "BatchLessonContent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchLessonContent" ADD CONSTRAINT "BatchLessonContent_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
