-- O unique (event_id, chalet_id) impedia que um chalé com devolução já quitada
-- (SETTLED) recebesse uma nova conta aberta com o saldo remanescente: encerrar
-- ou recalcular o rateio quebrava com P2002. A devolução quitada fica no
-- histórico e o resto vira uma nova linha OPEN.
-- DropIndex
DROP INDEX "receivables_event_id_chalet_id_key";

-- CreateIndex
CREATE INDEX "receivables_event_id_chalet_id_idx" ON "receivables"("event_id", "chalet_id");
