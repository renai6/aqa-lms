-- CreateEnum
CREATE TYPE "PaymentSource" AS ENUM ('SUBMITTED', 'CHECKOUT');

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "totalDue" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "purchaseId" TEXT,
ADD COLUMN     "source" "PaymentSource" NOT NULL DEFAULT 'SUBMITTED';

-- CreateIndex
CREATE INDEX "Payment_purchaseId_idx" ON "Payment"("purchaseId");

-- CreateIndex
CREATE INDEX "Payment_source_status_idx" ON "Payment"("source", "status");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
