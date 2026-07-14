import { nightsOf, staysOverlap } from './stay';

const stay = (checkIn: string, checkOut: string) => ({
  checkIn: new Date(checkIn),
  checkOut: new Date(checkOut),
});

describe('nightsOf', () => {
  it('conta os dias entre entrada e saída', () => {
    expect(nightsOf(stay('2030-01-04', '2030-01-06'))).toBe(2);
  });

  it('bate-volta conta 1 diária, não zero', () => {
    expect(nightsOf(stay('2030-01-04', '2030-01-04'))).toBe(1);
  });
});

describe('staysOverlap', () => {
  it('detecta períodos que se cruzam', () => {
    expect(
      staysOverlap(
        stay('2030-01-04', '2030-01-07'),
        stay('2030-01-06', '2030-01-09'),
      ),
    ).toBe(true);
  });

  it('troca no mesmo dia não é sobreposição: quem sai libera a suíte', () => {
    expect(
      staysOverlap(
        stay('2030-01-04', '2030-01-06'),
        stay('2030-01-06', '2030-01-08'),
      ),
    ).toBe(false);
  });

  it('bate-volta ocupa a suíte no dia da entrada', () => {
    expect(
      staysOverlap(
        stay('2030-01-04', '2030-01-04'),
        stay('2030-01-04', '2030-01-04'),
      ),
    ).toBe(true);
  });

  it('bate-volta não colide com quem entra no dia seguinte', () => {
    expect(
      staysOverlap(
        stay('2030-01-04', '2030-01-04'),
        stay('2030-01-05', '2030-01-07'),
      ),
    ).toBe(false);
  });
});
