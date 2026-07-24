import { nightsOf, stayCoversDay, staysOverlap, todayAsUtcDate } from './stay';

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

describe('stayCoversDay', () => {
  const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  it('cobre o dia da entrada', () => {
    expect(
      stayCoversDay(stay('2030-01-04', '2030-01-06'), day('2030-01-04')),
    ).toBe(true);
  });

  it('cobre os dias do meio', () => {
    expect(
      stayCoversDay(stay('2030-01-04', '2030-01-06'), day('2030-01-05')),
    ).toBe(true);
  });

  it('não cobre o dia da saída: o chalé já está livre', () => {
    expect(
      stayCoversDay(stay('2030-01-04', '2030-01-06'), day('2030-01-06')),
    ).toBe(false);
  });

  it('não cobre dia anterior à entrada', () => {
    expect(
      stayCoversDay(stay('2030-01-04', '2030-01-06'), day('2030-01-03')),
    ).toBe(false);
  });

  it('bate-volta cobre o dia da entrada', () => {
    expect(
      stayCoversDay(stay('2030-01-04', '2030-01-04'), day('2030-01-04')),
    ).toBe(true);
  });
});

describe('todayAsUtcDate', () => {
  it('usa o dia do fuso de Brasília, não o do relógio UTC', () => {
    // 01/02 00:30 UTC ainda é 31/01 às 21:30 em Brasília.
    expect(todayAsUtcDate(new Date('2030-02-01T00:30:00.000Z'))).toEqual(
      new Date('2030-01-31T00:00:00.000Z'),
    );
  });

  it('normaliza à meia-noite UTC, como as colunas de data', () => {
    expect(todayAsUtcDate(new Date('2030-02-01T18:00:00.000Z'))).toEqual(
      new Date('2030-02-01T00:00:00.000Z'),
    );
  });
});
