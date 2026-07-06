-- CreateEnum
CREATE TYPE "PaymentFrequency" AS ENUM ('MONTHLY', 'ONE_TIME', 'YEARLY');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "paymentFrequency" "PaymentFrequency",
ADD COLUMN     "miscFeeNote" TEXT;
