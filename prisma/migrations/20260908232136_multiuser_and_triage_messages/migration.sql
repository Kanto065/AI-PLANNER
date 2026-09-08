-- AlterTable
ALTER TABLE "ConversationSummary" ADD COLUMN     "messages" JSONB;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
