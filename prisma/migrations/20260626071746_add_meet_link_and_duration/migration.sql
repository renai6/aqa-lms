-- CreateEnum
CREATE TYPE "CourseDuration" AS ENUM ('SHORT', 'LONG');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "courseDuration" "CourseDuration",
ADD COLUMN     "meetLink" TEXT;
