-- CreateTable
CREATE TYPE "TimerStatus" AS ENUM ('RUNNING', 'STOPPED');

-- CreateTable
CREATE TABLE "time_entry_timers" (
    "id" TEXT NOT NULL,
    "status" "TimerStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "stoppedAt" TIMESTAMP(3),
    "spentDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "projectTaskId" TEXT NOT NULL,
    "approvalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entry_timers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_entry_timers_userId_status_idx" ON "time_entry_timers"("userId", "status");

-- CreateIndex
CREATE INDEX "time_entry_timers_userId_startedAt_idx" ON "time_entry_timers"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "time_entry_timers_userId_spentDate_idx" ON "time_entry_timers"("userId", "spentDate");

-- AddForeignKey
ALTER TABLE "time_entry_timers" ADD CONSTRAINT "time_entry_timers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry_timers" ADD CONSTRAINT "time_entry_timers_projectTaskId_fkey" FOREIGN KEY ("projectTaskId") REFERENCES "project_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry_timers" ADD CONSTRAINT "time_entry_timers_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "approvals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
