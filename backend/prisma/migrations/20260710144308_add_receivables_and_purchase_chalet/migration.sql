-- CreateEnum
CREATE TYPE "ReceivableStatus" AS ENUM ('OPEN', 'SETTLED');

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "chalet_id" TEXT;

-- CreateTable
CREATE TABLE "receivables" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "chalet_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "status" "ReceivableStatus" NOT NULL DEFAULT 'OPEN',
    "settled_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receivables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "receivables_status_idx" ON "receivables"("status");

-- CreateIndex
CREATE UNIQUE INDEX "receivables_event_id_chalet_id_key" ON "receivables"("event_id", "chalet_id");

-- CreateIndex
CREATE INDEX "purchases_chalet_id_idx" ON "purchases"("chalet_id");

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_chalet_id_fkey" FOREIGN KEY ("chalet_id") REFERENCES "chalets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_chalet_id_fkey" FOREIGN KEY ("chalet_id") REFERENCES "chalets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
