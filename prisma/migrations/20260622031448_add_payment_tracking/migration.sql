-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('PARTIAL', 'FULL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PARTIALLY_PAID', 'FULLY_PAID');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "tuitionFee" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PARTIALLY_PAID',
ADD COLUMN     "totalPaid" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "EnrollmentRequest" ADD COLUMN     "amountPaid" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "paymentType" "PaymentType" NOT NULL DEFAULT 'FULL';

-- CreateTable
CREATE TABLE "PaymentProof" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "proofUrl" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "note" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentProof_enrollmentId_idx" ON "PaymentProof"("enrollmentId");

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
