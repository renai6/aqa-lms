-- CreateEnum
CREATE TYPE "CourseType" AS ENUM ('ON_SITE', 'ONLINE');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "courseType" "CourseType" NOT NULL DEFAULT 'ON_SITE';
