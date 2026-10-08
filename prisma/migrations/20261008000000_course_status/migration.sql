-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('ENROLLMENT_ONGOING', 'CLASSES_ONGOING', 'SEMESTER_ENDED');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "courseStatus" "CourseStatus";
