import { Event } from '@prisma/client';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../../shared/domain/domain-error';
import { AuthenticatedUser } from '../../../../shared/infrastructure/auth/decorators';
import { ChaletRepository } from '../../../chalets/domain/chalet.repository';
import { EventRepository } from '../../../events/domain/event.repository';
import {
  ReservationDetail,
  ReservationRepository,
} from '../../domain/reservation.repository';
import {
  CancelReservationUseCase,
  CreateReservationUseCase,
  UpdateReservationUseCase,
} from './manage-reservation.use-cases';

const admin: AuthenticatedUser = {
  id: 'admin',
  email: 'a@a.com',
  name: 'Admin',
  role: 'ADMIN',
};
const owner: AuthenticatedUser = {
  id: 'owner',
  email: 'o@o.com',
  name: 'Owner',
  role: 'OWNER',
};

const openEvent = {
  id: 'e1',
  status: 'OPEN',
  startDate: new Date('2030-01-04'),
  endDate: new Date('2030-01-06'),
} as Event;

const reservation = {
  id: 'r1',
  eventId: 'e1',
  chaletId: 'c1',
  responsibleId: 'owner',
  checkIn: new Date('2030-01-04'),
  checkOut: new Date('2030-01-06'),
  adults: 2,
  children: 0,
  alcoholConsumers: 0,
  notes: null,
  status: 'ACTIVE',
  chalet: {
    id: 'c1',
    number: 1,
    name: 'Chalé 01',
    ownerId: 'owner',
    status: 'FREE',
  },
  responsible: { id: 'owner', name: 'Owner' },
} as unknown as ReservationDetail;

/** Entrada ativa já existente no chalé, usada para lotar as suítes nos testes. */
const activeStay = (id: string, checkIn: string, checkOut: string) =>
  ({
    ...reservation,
    id,
    checkIn: new Date(checkIn),
    checkOut: new Date(checkOut),
  }) as unknown as ReservationDetail;

const makeReservationRepo = (
  overrides: Partial<ReservationRepository> = {},
): ReservationRepository => ({
  findById: jest.fn().mockResolvedValue(reservation),
  listActiveByEventAndChalet: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue(reservation),
  update: jest.fn().mockResolvedValue(reservation),
  delete: jest.fn().mockResolvedValue(undefined),
  cancel: jest.fn().mockResolvedValue({ ...reservation, status: 'CANCELLED' }),
  list: jest.fn().mockResolvedValue([reservation]),
  ...overrides,
});

const makeEventRepo = (event: Event | null = openEvent): EventRepository =>
  ({
    findById: jest.fn().mockResolvedValue(event),
  }) as unknown as EventRepository;

const makeChaletRepo = (ownerId: string | null = 'owner'): ChaletRepository =>
  ({
    findById: jest
      .fn()
      .mockResolvedValue({ id: 'c1', number: 1, ownerId, owner: null }),
  }) as unknown as ChaletRepository;

const validInput = {
  eventId: 'e1',
  chaletId: 'c1',
  checkIn: new Date('2030-01-04'),
  checkOut: new Date('2030-01-06'),
  adults: 2,
  children: 0,
  alcoholConsumers: 1,
};

describe('CreateReservationUseCase', () => {
  it('proprietário reserva o próprio chalé', async () => {
    const repo = makeReservationRepo();
    const useCase = new CreateReservationUseCase(
      repo,
      makeEventRepo(),
      makeChaletRepo(),
    );
    await useCase.execute(validInput, owner);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ responsibleId: 'owner' }),
    );
  });

  it('proprietário não reserva chalé alheio', async () => {
    const useCase = new CreateReservationUseCase(
      makeReservationRepo(),
      makeEventRepo(),
      makeChaletRepo('outro-dono'),
    );
    await expect(useCase.execute(validInput, owner)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('admin reserva qualquer chalé indicando responsável', async () => {
    const repo = makeReservationRepo();
    const useCase = new CreateReservationUseCase(
      repo,
      makeEventRepo(),
      makeChaletRepo('outro'),
    );
    await useCase.execute({ ...validInput, responsibleId: 'outro' }, admin);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ responsibleId: 'outro' }),
    );
  });

  it('aceita outra entrada no chalé que já tem reserva no evento', async () => {
    const repo = makeReservationRepo({
      listActiveByEventAndChalet: jest
        .fn()
        .mockResolvedValue([activeStay('r1', '2030-01-04', '2030-01-06')]),
    });
    const useCase = new CreateReservationUseCase(
      repo,
      makeEventRepo(),
      makeChaletRepo(),
    );
    await useCase.execute(validInput, owner);
    expect(repo.create).toHaveBeenCalled();
  });

  it('bloqueia a 4ª entrada simultânea: só há 3 suítes', async () => {
    const repo = makeReservationRepo({
      listActiveByEventAndChalet: jest
        .fn()
        .mockResolvedValue([
          activeStay('r1', '2030-01-04', '2030-01-06'),
          activeStay('r2', '2030-01-04', '2030-01-06'),
          activeStay('r3', '2030-01-05', '2030-01-06'),
        ]),
    });
    const useCase = new CreateReservationUseCase(
      repo,
      makeEventRepo(),
      makeChaletRepo(),
    );
    await expect(useCase.execute(validInput, owner)).rejects.toThrow(
      ConflictError,
    );
  });

  it('aceita entrada em sequência: quem sai libera a suíte no mesmo dia', async () => {
    const repo = makeReservationRepo({
      listActiveByEventAndChalet: jest
        .fn()
        .mockResolvedValue([
          activeStay('r1', '2030-01-04', '2030-01-05'),
          activeStay('r2', '2030-01-04', '2030-01-05'),
          activeStay('r3', '2030-01-04', '2030-01-05'),
        ]),
    });
    const useCase = new CreateReservationUseCase(
      repo,
      makeEventRepo(),
      makeChaletRepo(),
    );
    await useCase.execute(
      { ...validInput, checkIn: new Date('2030-01-05') },
      owner,
    );
    expect(repo.create).toHaveBeenCalled();
  });

  it('bloqueia reserva em evento encerrado', async () => {
    const useCase = new CreateReservationUseCase(
      makeReservationRepo(),
      makeEventRepo({ ...openEvent, status: 'CLOSED' }),
      makeChaletRepo(),
    );
    await expect(useCase.execute(validInput, owner)).rejects.toThrow(
      ConflictError,
    );
  });

  it('bloqueia estadia fora do período do evento', async () => {
    const useCase = new CreateReservationUseCase(
      makeReservationRepo(),
      makeEventRepo(),
      makeChaletRepo(),
    );
    await expect(
      useCase.execute(
        { ...validInput, checkIn: new Date('2030-01-03') },
        owner,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('falha se evento não existe', async () => {
    const useCase = new CreateReservationUseCase(
      makeReservationRepo(),
      makeEventRepo(null),
      makeChaletRepo(),
    );
    await expect(useCase.execute(validInput, owner)).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe('UpdateReservationUseCase', () => {
  it('admin atualiza reserva', async () => {
    const repo = makeReservationRepo();
    const useCase = new UpdateReservationUseCase(repo, makeEventRepo());
    await useCase.execute({ id: 'r1', adults: 3 }, admin);
    expect(repo.update).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({ adults: 3 }),
    );
  });

  it('proprietário não altera reserva, mesmo sendo o responsável', async () => {
    const useCase = new UpdateReservationUseCase(
      makeReservationRepo(),
      makeEventRepo(),
    );
    await expect(
      useCase.execute({ id: 'r1', adults: 3 }, owner),
    ).rejects.toThrow(ForbiddenError);
  });

  it('a própria reserva não conta contra o limite de suítes ao editar', async () => {
    const repo = makeReservationRepo({
      listActiveByEventAndChalet: jest
        .fn()
        .mockResolvedValue([
          activeStay('r1', '2030-01-04', '2030-01-06'),
          activeStay('r2', '2030-01-04', '2030-01-06'),
          activeStay('r3', '2030-01-04', '2030-01-06'),
        ]),
    });
    const useCase = new UpdateReservationUseCase(repo, makeEventRepo());
    await useCase.execute({ id: 'r1', adults: 3 }, admin);
    expect(repo.update).toHaveBeenCalled();
  });

  it('bloqueia edição que lota as suítes num período já cheio', async () => {
    const repo = makeReservationRepo({
      listActiveByEventAndChalet: jest
        .fn()
        .mockResolvedValue([
          activeStay('r1', '2030-01-04', '2030-01-05'),
          activeStay('r2', '2030-01-05', '2030-01-06'),
          activeStay('r3', '2030-01-05', '2030-01-06'),
          activeStay('r4', '2030-01-05', '2030-01-06'),
        ]),
    });
    const useCase = new UpdateReservationUseCase(repo, makeEventRepo());
    // r1 sai de 04–05 (livre) e tenta ir para 05–06, onde já há 3 entradas.
    await expect(
      useCase.execute(
        { id: 'r1', checkIn: new Date('2030-01-05') },
        admin,
      ),
    ).rejects.toThrow(ConflictError);
  });
});

describe('CancelReservationUseCase', () => {
  it('cancela reserva ativa', async () => {
    const repo = makeReservationRepo();
    const useCase = new CancelReservationUseCase(repo, makeEventRepo());
    const result = await useCase.execute('r1', admin);
    expect(result.status).toBe('CANCELLED');
  });

  it('não cancela com evento encerrado', async () => {
    const useCase = new CancelReservationUseCase(
      makeReservationRepo(),
      makeEventRepo({ ...openEvent, status: 'CLOSED' }),
    );
    await expect(useCase.execute('r1', admin)).rejects.toThrow(ConflictError);
  });

  it('proprietário não cancela a própria reserva', async () => {
    const useCase = new CancelReservationUseCase(
      makeReservationRepo(),
      makeEventRepo(),
    );
    await expect(useCase.execute('r1', owner)).rejects.toThrow(ForbiddenError);
  });
});
