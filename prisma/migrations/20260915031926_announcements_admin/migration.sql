-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('EVERYONE', 'COURSES');

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "audience" "AnnouncementAudience" NOT NULL DEFAULT 'EVERYONE',
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AnnouncementCourse" (
    "announcementId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "AnnouncementCourse_pkey" PRIMARY KEY ("announcementId","courseId")
);

-- CreateIndex
CREATE INDEX "AnnouncementCourse_courseId_idx" ON "AnnouncementCourse"("courseId");

-- AddForeignKey
ALTER TABLE "AnnouncementCourse" ADD CONSTRAINT "AnnouncementCourse_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementCourse" ADD CONSTRAINT "AnnouncementCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing published announcements keep their order: they are dated by
-- when they were created, since they predate publishedAt.
UPDATE "Announcement" SET "publishedAt" = "createdAt" WHERE "isPublished" = true;
