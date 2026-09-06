/*
  Warnings:

  - You are about to drop the column `recordingUrl` on the `BatchLessonContent` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BatchLessonContent" DROP COLUMN "recordingUrl",
ADD COLUMN     "audioUrl" TEXT,
ADD COLUMN     "pptUrl" TEXT;

-- CreateTable
CREATE TABLE "BatchRecording" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchRecording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BatchRecording_batchId_subjectId_idx" ON "BatchRecording"("batchId", "subjectId");

-- AddForeignKey
ALTER TABLE "BatchRecording" ADD CONSTRAINT "BatchRecording_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchRecording" ADD CONSTRAINT "BatchRecording_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
