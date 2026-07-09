import { ValidationError } from './domain-error';

export class DateRange {
  private constructor(
    readonly start: Date,
    readonly end: Date,
  ) {}

  static create(start: Date, end: Date): DateRange {
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new ValidationError('Datas inválidas.');
    }
    if (end < start) {
      throw new ValidationError(
        'Data final deve ser igual ou posterior à inicial.',
      );
    }
    return new DateRange(start, end);
  }

  contains(other: DateRange): boolean {
    return other.start >= this.start && other.end <= this.end;
  }

  overlaps(other: DateRange): boolean {
    return this.start <= other.end && other.start <= this.end;
  }
}
