-- AlterEnum
ALTER TYPE "QuestionType" ADD VALUE 'FILE_UPLOAD';

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "uploadFolderUrl" TEXT;
