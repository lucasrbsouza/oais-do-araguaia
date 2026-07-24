import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../shared/domain/domain-error';
import { nightsOf } from '../../../shared/domain/stay';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';

export interface ReservationDetail {
  id: string;
  responsibleName: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  adults: number;
  children: number;
  alcoholConsumers: number;
  totalPeople: number;
}

export interface ChaletGuestsRow {
  chaletId: string;
  chaletNumber: number;
  chaletName: string;
  ownerName: string | null;
  adults: number;
  children: number;
  alcoholConsumers: number;
  totalPeople: number;
  reservations: ReservationDetail[];
}

export interface ReservationsReport {
  event: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    status: string;
  };
  chalets: ChaletGuestsRow[];
  totals: {
    adults: number;
    children: number;
    alcoholConsumers: number;
    totalPeople: number;
    reservations: number;
    chaletsOccupied: number;
  };
}

/**
 * Relatório geral de reservas de um evento: quem está em cada chalé, quantos
 * adultos, crianças e consumidores de bebida alcoólica.
 *
 * Todos os chalés aparecem, inclusive os sem reserva — o vazio é justamente o
 * que a administração precisa enxergar.
 *
 * `totalPeople` soma adultos e crianças. Consumidores de álcool ficam fora da
 * conta porque podem ser visitantes que não se hospedam, e somá-los inflaria o
 * total de hóspedes.
 */
@Injectable()
export class ReservationsReportService {
  constructor(private readonly prisma: PrismaService) {}

  async byEvent(eventId: string): Promise<ReservationsReport> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundError('Evento não encontrado.');
    }

    const [chalets, reservations] = await Promise.all([
      this.prisma.chalet.findMany({
        include: { owner: true },
        orderBy: { number: 'asc' },
      }),
      this.prisma.reservation.findMany({
        where: { eventId, status: 'ACTIVE' },
        include: { responsible: true },
        orderBy: [{ checkIn: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    const porChale = new Map<string, ReservationDetail[]>();
    for (const r of reservations) {
      const detalhe: ReservationDetail = {
        id: r.id,
        responsibleName: r.responsible.name,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        nights: nightsOf({ checkIn: r.checkIn, checkOut: r.checkOut }),
        adults: r.adults,
        children: r.children,
        alcoholConsumers: r.alcoholConsumers,
        totalPeople: r.adults + r.children,
      };
      const atuais = porChale.get(r.chaletId);
      if (atuais) atuais.push(detalhe);
      else porChale.set(r.chaletId, [detalhe]);
    }

    const rows: ChaletGuestsRow[] = chalets.map((chalet) => {
      const entradas = porChale.get(chalet.id) ?? [];
      return {
        chaletId: chalet.id,
        chaletNumber: chalet.number,
        chaletName: chalet.name,
        ownerName: chalet.owner?.name ?? null,
        adults: soma(entradas, (e) => e.adults),
        children: soma(entradas, (e) => e.children),
        alcoholConsumers: soma(entradas, (e) => e.alcoholConsumers),
        totalPeople: soma(entradas, (e) => e.totalPeople),
        reservations: entradas,
      };
    });

    return {
      event: {
        id: event.id,
        name: event.name,
        startDate: event.startDate,
        endDate: event.endDate,
        status: event.status,
      },
      chalets: rows,
      totals: {
        adults: soma(rows, (r) => r.adults),
        children: soma(rows, (r) => r.children),
        alcoholConsumers: soma(rows, (r) => r.alcoholConsumers),
        totalPeople: soma(rows, (r) => r.totalPeople),
        reservations: reservations.length,
        chaletsOccupied: rows.filter((r) => r.reservations.length > 0).length,
      },
    };
  }
}

function soma<T>(itens: T[], valor: (item: T) => number): number {
  return itens.reduce((total, item) => total + valor(item), 0);
}
