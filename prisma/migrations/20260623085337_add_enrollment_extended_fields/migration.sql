/*
  Warnings:

  - Added the required column `address` to the `EnrollmentRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contactNumber` to the `EnrollmentRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `facebookLink` to the `EnrollmentRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `facebookName` to the `EnrollmentRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gender` to the `EnrollmentRequest` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StudentType" AS ENUM ('NEW', 'OLD');

-- AlterTable
ALTER TABLE "EnrollmentRequest" ADD COLUMN     "address" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "contactNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "facebookLink" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "facebookName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "gender" "Gender" NOT NULL DEFAULT 'MALE',
ADD COLUMN     "studentType" "StudentType" NOT NULL DEFAULT 'NEW';

-- Drop temporary backfill defaults for fields that require explicit app-supplied values.
-- Note: studentType retains its DEFAULT 'NEW' (matches @default(NEW) in schema).
ALTER TABLE "EnrollmentRequest" ALTER COLUMN "address" DROP DEFAULT;
ALTER TABLE "EnrollmentRequest" ALTER COLUMN "contactNumber" DROP DEFAULT;
ALTER TABLE "EnrollmentRequest" ALTER COLUMN "facebookLink" DROP DEFAULT;
ALTER TABLE "EnrollmentRequest" ALTER COLUMN "facebookName" DROP DEFAULT;
ALTER TABLE "EnrollmentRequest" ALTER COLUMN "gender" DROP DEFAULT;
