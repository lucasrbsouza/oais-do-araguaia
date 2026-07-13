-- CreateEnum
CREATE TYPE "SettlementAutoMode" AS ENUM ('MANUAL', 'ON_PURCHASE', 'INTERVAL');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "settlement_auto_minutes" INTEGER,
ADD COLUMN     "settlement_auto_mode" "SettlementAutoMode" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "settlement_auto_set_by_id" TEXT;
