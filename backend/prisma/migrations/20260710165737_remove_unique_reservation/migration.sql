-- DropIndex
DROP INDEX "reservations_event_id_chalet_id_key";

-- CreateIndex
CREATE INDEX "reservations_event_id_chalet_id_idx" ON "reservations"("event_id", "chalet_id");
