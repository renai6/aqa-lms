-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Course_archivedAt_idx" ON "Course"("archivedAt");
