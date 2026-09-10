-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "planWeekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "planSessionMinutes" INTEGER,
ADD COLUMN     "planPreferredStartMinutes" INTEGER;
