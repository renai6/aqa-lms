-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "periodMonth" DATE;

-- CreateIndex
CREATE INDEX "Payment_enrollmentId_periodMonth_idx" ON "Payment"("enrollmentId", "periodMonth");
