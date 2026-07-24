import { chaletStatusOf, deriveChaletStatuses } from './chalet-occupancy';

const hoje = new Date('2030-05-10T00:00:00.000Z');
const stay = (chaletId: string, checkIn: string, checkOut: string) => ({
  chaletId,
  checkIn: new Date(`${checkIn}T00:00:00.000Z`),
  checkOut: new Date(`${checkOut}T00:00:00.000Z`),
});

describe('deriveChaletStatuses', () => {
  it('estadia em andamento deixa o chalé ocupado', () => {
    const statuses = deriveChaletStatuses(
      [stay('c1', '2030-05-09', '2030-05-12')],
      hoje,
    );
    expect(statuses.get('c1')).toBe('OCCUPIED');
  });

  it('reserva futura deixa o chalé reservado', () => {
    const statuses = deriveChaletStatuses(
      [stay('c1', '2030-06-01', '2030-06-03')],
      hoje,
    );
    expect(statuses.get('c1')).toBe('RESERVED');
  });

  it('estadia em andamento manda sobre reserva futura do mesmo chalé', () => {
    const statuses = deriveChaletStatuses(
      [
        stay('c1', '2030-06-01', '2030-06-03'),
        stay('c1', '2030-05-09', '2030-05-12'),
      ],
      hoje,
    );
    expect(statuses.get('c1')).toBe('OCCUPIED');
  });

  it('ordem das reservas não muda o resultado', () => {
    const statuses = deriveChaletStatuses(
      [
        stay('c1', '2030-05-09', '2030-05-12'),
        stay('c1', '2030-06-01', '2030-06-03'),
      ],
      hoje,
    );
    expect(statuses.get('c1')).toBe('OCCUPIED');
  });

  it('cada chalé recebe o próprio status', () => {
    const statuses = deriveChaletStatuses(
      [
        stay('c1', '2030-05-09', '2030-05-12'),
        stay('c2', '2030-06-01', '2030-06-03'),
      ],
      hoje,
    );
    expect(statuses.get('c1')).toBe('OCCUPIED');
    expect(statuses.get('c2')).toBe('RESERVED');
  });

  it('quem saiu hoje liberou o chalé: fica livre, não reservado', () => {
    const statuses = deriveChaletStatuses(
      [stay('c1', '2030-05-08', '2030-05-10')],
      hoje,
    );
    expect(chaletStatusOf(statuses, 'c1')).toBe('FREE');
  });

  it('sem reserva nenhuma, o mapa fica vazio', () => {
    expect(deriveChaletStatuses([], hoje).size).toBe(0);
  });
});

describe('chaletStatusOf', () => {
  it('chalé fora do mapa está livre', () => {
    expect(chaletStatusOf(new Map(), 'c9')).toBe('FREE');
  });
});
