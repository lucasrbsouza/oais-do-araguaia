import { NotFoundError } from '../../../shared/domain/domain-error';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import { ReservationsReportService } from './reservations-report.service';

const evento = {
  id: 'e1',
  name: 'Final de Semana',
  startDate: new Date('2030-07-17T00:00:00.000Z'),
  endDate: new Date('2030-07-19T00:00:00.000Z'),
  status: 'OPEN',
};

const chale = (id: string, number: number, ownerName: string | null) => ({
  id,
  number,
  name: `Chalé 0${number}`,
  owner: ownerName ? { name: ownerName } : null,
});

const reserva = (
  chaletId: string,
  responsibleName: string,
  adults: number,
  children: number,
  alcoholConsumers: number,
  checkIn = '2030-07-17',
  checkOut = '2030-07-19',
) => ({
  id: `r-${chaletId}-${responsibleName}`,
  chaletId,
  responsible: { name: responsibleName },
  checkIn: new Date(`${checkIn}T00:00:00.000Z`),
  checkOut: new Date(`${checkOut}T00:00:00.000Z`),
  adults,
  children,
  alcoholConsumers,
});

const makePrisma = (
  chalets: unknown[],
  reservations: unknown[],
  event: unknown = evento,
): PrismaService =>
  ({
    event: { findUnique: jest.fn().mockResolvedValue(event) },
    chalet: { findMany: jest.fn().mockResolvedValue(chalets) },
    reservation: { findMany: jest.fn().mockResolvedValue(reservations) },
  }) as unknown as PrismaService;

describe('ReservationsReportService', () => {
  it('falha para evento inexistente', async () => {
    const service = new ReservationsReportService(makePrisma([], [], null));
    await expect(service.byEvent('nao-existe')).rejects.toThrow(NotFoundError);
  });

  it('soma as reservas do mesmo chalé numa linha só', async () => {
    const service = new ReservationsReportService(
      makePrisma(
        [chale('c1', 1, 'João')],
        [
          reserva('c1', 'Ana', 4, 2, 3),
          reserva('c1', 'Pedro', 8, 2, 5, '2030-07-18', '2030-07-19'),
        ],
      ),
    );
    const report = await service.byEvent('e1');

    expect(report.chalets).toHaveLength(1);
    expect(report.chalets[0]).toMatchObject({
      chaletNumber: 1,
      ownerName: 'João',
      adults: 12,
      children: 4,
      alcoholConsumers: 8,
      totalPeople: 16,
    });
    expect(report.chalets[0].reservations).toHaveLength(2);
  });

  it('total de pessoas não inclui quem só bebe: podem ser visitantes', async () => {
    const service = new ReservationsReportService(
      makePrisma([chale('c1', 1, null)], [reserva('c1', 'Ana', 2, 1, 9)]),
    );
    const report = await service.byEvent('e1');
    expect(report.chalets[0].totalPeople).toBe(3);
    expect(report.totals.totalPeople).toBe(3);
    expect(report.totals.alcoholConsumers).toBe(9);
  });

  it('chalé sem reserva aparece zerado, não some do relatório', async () => {
    const service = new ReservationsReportService(
      makePrisma(
        [chale('c1', 1, 'João'), chale('c2', 2, null)],
        [reserva('c1', 'Ana', 2, 0, 2)],
      ),
    );
    const report = await service.byEvent('e1');

    expect(report.chalets).toHaveLength(2);
    expect(report.chalets[1]).toMatchObject({
      chaletNumber: 2,
      adults: 0,
      children: 0,
      totalPeople: 0,
      ownerName: null,
    });
    expect(report.chalets[1].reservations).toEqual([]);
    expect(report.totals.chaletsOccupied).toBe(1);
  });

  it('totais fecham com a soma dos chalés', async () => {
    const service = new ReservationsReportService(
      makePrisma(
        [chale('c1', 1, 'João'), chale('c2', 2, 'Maria')],
        [
          reserva('c1', 'Ana', 4, 2, 3),
          reserva('c2', 'Bia', 2, 1, 2),
          reserva('c2', 'Caio', 3, 0, 1),
        ],
      ),
    );
    const report = await service.byEvent('e1');

    expect(report.totals).toMatchObject({
      adults: 9,
      children: 3,
      alcoholConsumers: 6,
      totalPeople: 12,
      reservations: 3,
      chaletsOccupied: 2,
    });
    const somaAdultos = report.chalets.reduce((s, c) => s + c.adults, 0);
    expect(somaAdultos).toBe(report.totals.adults);
  });

  it('conta diárias de cada reserva, e bate-volta conta 1', async () => {
    const service = new ReservationsReportService(
      makePrisma(
        [chale('c1', 1, null)],
        [
          reserva('c1', 'Ana', 2, 0, 0, '2030-07-17', '2030-07-19'),
          reserva('c1', 'Bia', 1, 0, 0, '2030-07-18', '2030-07-18'),
        ],
      ),
    );
    const report = await service.byEvent('e1');
    expect(report.chalets[0].reservations.map((r) => r.nights)).toEqual([2, 1]);
  });
});
