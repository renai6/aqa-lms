/*
  Warnings:

  - A unique constraint covering the columns `[lessonId]` on the table `Assessment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "lessonId" TEXT;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "sequentialLessons" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_lessonId_key" ON "Assessment"("lessonId");

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
