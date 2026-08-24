-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "removedReason" TEXT;
