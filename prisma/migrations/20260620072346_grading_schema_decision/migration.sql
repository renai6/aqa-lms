-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "passingGrade" DOUBLE PRECISION NOT NULL DEFAULT 75.0;

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "units" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
