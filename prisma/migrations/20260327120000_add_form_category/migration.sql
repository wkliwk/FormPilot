-- AlterEnum
ALTER TYPE "SourceType" ADD VALUE 'IMAGE';

-- AlterTable
ALTER TABLE "Form" ADD COLUMN "category" TEXT;
