-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "startsOn" TIMESTAMP(3),
ADD COLUMN     "endsOn" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "metadata" JSONB;
