/*
  Warnings:

  - You are about to drop the column `totalPaid` on the `Enrollment` table. All the data in the column will be lost.
  - You are about to drop the `EnrollmentRequest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PaymentProof` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "EnrollmentRequest" DROP CONSTRAINT "EnrollmentRequest_courseId_fkey";

-- DropForeignKey
ALTER TABLE "EnrollmentRequest" DROP CONSTRAINT "EnrollmentRequest_userId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentProof" DROP CONSTRAINT "PaymentProof_enrollmentId_fkey";

-- AlterTable
ALTER TABLE "Enrollment" DROP COLUMN "totalPaid",
ADD COLUMN     "purchaseId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" TEXT,
ADD COLUMN     "contactNumber" TEXT,
ADD COLUMN     "facebookLink" TEXT,
ADD COLUMN     "facebookName" TEXT,
ADD COLUMN     "studentType" "StudentType";

-- DropTable
DROP TABLE "EnrollmentRequest";

-- DropTable
DROP TABLE "PaymentProof";

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentType" "PaymentType" NOT NULL DEFAULT 'FULL',
    "amountPaid" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paymentProofUrl" TEXT NOT NULL,
    "adminRemarks" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Purchase_userId_idx" ON "Purchase"("userId");

-- CreateIndex
CREATE INDEX "PurchaseItem_courseId_idx" ON "PurchaseItem"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseItem_purchaseId_courseId_key" ON "PurchaseItem"("purchaseId", "courseId");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
