-- CreateEnum
CREATE TYPE "QuestionMediaType" AS ENUM ('AUDIO', 'IMAGE');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "mediaType" "QuestionMediaType",
ADD COLUMN     "mediaUrl" TEXT;
