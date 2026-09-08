-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DROPPED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "FeasibilityStatus" AS ENUM ('UNKNOWN', 'ON_TRACK', 'AT_RISK', 'UNREALISTIC');

-- CreateEnum
CREATE TYPE "FeasibilitySource" AS ENUM ('SYSTEM', 'USER_OVERRIDE', 'TRIAGE');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "estimatedHours" DOUBLE PRECISION,
    "deadline" TIMESTAMP(3),
    "progressPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "feasibilityScore" DOUBLE PRECISION,
    "feasibilityStatus" "FeasibilityStatus" NOT NULL DEFAULT 'UNKNOWN',
    "feasibilityReason" TEXT,
    "feasibilityUpdatedAt" TIMESTAMP(3),
    "feasibilityOverride" BOOLEAN NOT NULL DEFAULT false,
    "feasibilityOverrideNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalFeasibilityLog" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "status" "FeasibilityStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "source" "FeasibilitySource" NOT NULL DEFAULT 'SYSTEM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalFeasibilityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "estimatedMinutes" INTEGER,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "isRoutine" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationSummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawInput" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actions" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Goal_userId_idx" ON "Goal"("userId");

-- CreateIndex
CREATE INDEX "Goal_userId_status_idx" ON "Goal"("userId", "status");

-- CreateIndex
CREATE INDEX "GoalFeasibilityLog_goalId_createdAt_idx" ON "GoalFeasibilityLog"("goalId", "createdAt");

-- CreateIndex
CREATE INDEX "Task_userId_scheduledDate_idx" ON "Task"("userId", "scheduledDate");

-- CreateIndex
CREATE INDEX "Task_goalId_idx" ON "Task"("goalId");

-- CreateIndex
CREATE INDEX "TimeLog_taskId_idx" ON "TimeLog"("taskId");

-- CreateIndex
CREATE INDEX "TimeLog_userId_startedAt_idx" ON "TimeLog"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserStats_userId_key" ON "UserStats"("userId");

-- CreateIndex
CREATE INDEX "ConversationSummary_userId_createdAt_idx" ON "ConversationSummary"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalFeasibilityLog" ADD CONSTRAINT "GoalFeasibilityLog_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeLog" ADD CONSTRAINT "TimeLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeLog" ADD CONSTRAINT "TimeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStats" ADD CONSTRAINT "UserStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationSummary" ADD CONSTRAINT "ConversationSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
