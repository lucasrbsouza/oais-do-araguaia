import { ChaletStatus } from '@prisma/client';
import { stayCoversDay } from '../../../shared/domain/stay';

export interface ChaletStay {
  chaletId: string;
  checkIn: Date;
  checkOut: Date;
}

/**
 * Ocupação sai das reservas, nunca de um campo editado à mão: quem reserva vê
 * o status mudar sozinho, sem ninguém abrir o chalé para corrigir.
 *
 * Estadia em andamento manda sobre reserva futura — chalé com hóspede hoje
 * está ocupado, mesmo que também tenha reserva para o mês que vem. Chalé sem
 * nenhuma estadia não entra no mapa: é livre.
 *
 * Estadia que já terminou não conta: quem saiu hoje devolveu o chalé, e ele
 * volta a ficar livre em vez de virar "reservado".
 */
export function deriveChaletStatuses(
  stays: ChaletStay[],
  today: Date,
): Map<string, ChaletStatus> {
  const statuses = new Map<string, ChaletStatus>();
  for (const stay of stays) {
    const jaOcupado = statuses.get(stay.chaletId) === ChaletStatus.OCCUPIED;
    if (stayCoversDay(stay, today)) {
      statuses.set(stay.chaletId, ChaletStatus.OCCUPIED);
    } else if (stay.checkIn.getTime() > today.getTime() && !jaOcupado) {
      statuses.set(stay.chaletId, ChaletStatus.RESERVED);
    }
  }
  return statuses;
}

/** Sem estadia registrada, o chalé está livre. */
export function chaletStatusOf(
  statuses: Map<string, ChaletStatus>,
  chaletId: string,
): ChaletStatus {
  return statuses.get(chaletId) ?? ChaletStatus.FREE;
}
