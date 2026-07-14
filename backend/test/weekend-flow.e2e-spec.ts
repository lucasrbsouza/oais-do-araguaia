import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/shared/infrastructure/http/all-exceptions.filter';
import { PrismaService } from '../src/shared/infrastructure/database/prisma.service';

/**
 * Fluxo completo do final de semana:
 * login → evento → reservas → compras → rateio → fechar → pagamento → relatório.
 * Requer PostgreSQL/Redis de dev rodando e seed aplicado (admin + 11 chalés).
 */
describe('Fluxo do final de semana (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let eventId: string;
  let chaletIds: string[];

  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);
    // isola dados de execuções anteriores do teste
    await prisma.payment.deleteMany({});
    await prisma.settlement.deleteMany({});
    await prisma.purchase.deleteMany({});
    await prisma.reservation.deleteMany({});
    await prisma.event.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
  });

  it('autentica o administrador', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL ?? 'admin@oaisdoaraguaia.com.br',
        password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123',
      })
      .expect(200);
    token = res.body.accessToken;
    expect(res.body.user.role).toBe('ADMIN');
  });

  it('rejeita credenciais inválidas', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@oaisdoaraguaia.com.br', password: 'senha-errada' })
      .expect(401);
  });

  it('lista os 11 chalés', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/chalets')
      .set(auth())
      .expect(200);
    expect(res.body).toHaveLength(11);
    chaletIds = res.body.map((c: { id: string }) => c.id);
  });

  it('cria o evento do final de semana', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/events')
      .set(auth())
      .send({ name: 'FDS E2E', startDate: '2030-01-04', endDate: '2030-01-06' })
      .expect(201);
    eventId = res.body.id;
    expect(res.body.status).toBe('OPEN');
  });

  it('bloqueia evento sobreposto', async () => {
    await request(app.getHttpServer())
      .post('/api/events')
      .set(auth())
      .send({
        name: 'Duplicado',
        startDate: '2030-01-05',
        endDate: '2030-01-07',
      })
      .expect(409);
  });

  it('cria reservas com pesos distintos', async () => {
    const make = (
      chaletId: string,
      adults: number,
      children: number,
      alcohol: number,
      checkIn = '2030-01-04',
      checkOut = '2030-01-06',
    ) =>
      request(app.getHttpServer()).post('/api/reservations').set(auth()).send({
        eventId,
        chaletId,
        checkIn,
        checkOut,
        adults,
        children,
        alcoholConsumers: alcohol,
      });

    await make(chaletIds[0], 2, 2, 2).expect(201);
    await make(chaletIds[1], 3, 0, 0).expect(201);
    await make(chaletIds[2], 1, 1, 1).expect(201);
    // Mesmo chalé recebe outras entradas: são 3 suítes, e as estadias têm
    // durações diferentes (esta fica só 1 diária).
    await make(chaletIds[0], 2, 0, 1, '2030-01-05').expect(201);
    await make(chaletIds[0], 1, 0, 0).expect(201);
    // 4ª entrada simultânea: as 3 suítes já estão ocupadas.
    await make(chaletIds[0], 1, 0, 0, '2030-01-05').expect(409);
  });

  it('aceita entrada em sequência mesmo com as suítes lotadas', async () => {
    // As 3 entradas do chalé 0 terminam em 06/01; quem entra em 06/01 não
    // disputa suíte com elas.
    await request(app.getHttpServer())
      .post('/api/reservations')
      .set(auth())
      .send({
        eventId,
        chaletId: chaletIds[0],
        checkIn: '2030-01-06',
        checkOut: '2030-01-06',
        adults: 1,
        children: 0,
        alcoholConsumers: 0,
      })
      .expect(201)
      .then((res) =>
        request(app.getHttpServer())
          .delete(`/api/reservations/${res.body.id}`)
          .set(auth())
          .expect(204),
      );
  });

  it('rejeita reserva fora do período do evento', async () => {
    await request(app.getHttpServer())
      .post('/api/reservations')
      .set(auth())
      .send({
        eventId,
        chaletId: chaletIds[3],
        checkIn: '2030-01-03',
        checkOut: '2030-01-06',
        adults: 1,
        children: 0,
        alcoholConsumers: 0,
      })
      .expect(422);
  });

  it('lança compras (comuns e álcool)', async () => {
    const make = (category: string, amountCents: number) =>
      request(app.getHttpServer()).post('/api/purchases').set(auth()).send({
        eventId,
        date: '2030-01-04',
        description: category,
        category,
        amountCents,
      });

    await make('GROCERY', 45000).expect(201);
    await make('MEAT', 38000).expect(201);
    await make('ALCOHOL', 21000).expect(201);
    await make('ICE', 3001).expect(201);
  });

  it('calcula o rateio: soma exata e álcool só entre consumidores', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/events/${eventId}/settlement/calculate`)
      .set(auth())
      .expect(200);

    const { items, totalCents, commonTotalCents, alcoholTotalCents } = res.body;
    expect(commonTotalCents).toBe(86001);
    expect(alcoholTotalCents).toBe(21000);
    expect(totalCents).toBe(107001);

    const sum = items.reduce(
      (acc: number, i: { totalCents: number }) => acc + i.totalCents,
      0,
    );
    expect(sum).toBe(totalCents);

    const noAlcohol = items.find(
      (i: { chaletId: string }) => i.chaletId === chaletIds[1],
    );
    expect(noAlcohol.alcoholCents).toBe(0);

    // As 3 entradas do chalé 0 somam numa cota única — o rateio tem um item
    // por chalé, não por entrada.
    expect(items).toHaveLength(3);

    // Pesos em pessoa-diária: chalé 0 = (2a+2c)×2 + (2a)×1 + (1a)×2 = 100,
    // chalé 1 = (3a)×2 = 60, chalé 2 = (1a+1c)×2 = 30.
    const byChalet = (id: string) =>
      items.find((i: { chaletId: string }) => i.chaletId === id);
    expect(byChalet(chaletIds[0]).commonCents).toBe(45264);
    expect(byChalet(chaletIds[1]).commonCents).toBe(27158);
    expect(byChalet(chaletIds[2]).commonCents).toBe(13579);

    // Álcool em consumidor-diária: 2×2 + 1×1 = 5, 0, 1×2 = 2.
    expect(byChalet(chaletIds[0]).alcoholCents).toBe(15000);
    expect(byChalet(chaletIds[2]).alcoholCents).toBe(6000);
  });

  it('fecha o evento e congela alterações', async () => {
    await request(app.getHttpServer())
      .post(`/api/events/${eventId}/close`)
      .set(auth())
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/purchases')
      .set(auth())
      .send({
        eventId,
        date: '2030-01-05',
        description: 'Depois de fechado',
        category: 'OTHER',
        amountCents: 100,
      })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/api/events/${eventId}/settlement/calculate`)
      .set(auth())
      .expect(409);
  });

  it('registra pagamento e deriva status parcial', async () => {
    await request(app.getHttpServer())
      .post('/api/payments')
      .set(auth())
      .send({
        eventId,
        chaletId: chaletIds[0],
        date: '2030-01-07',
        amountCents: 10000,
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/events/${eventId}/payments`)
      .set(auth())
      .expect(200);

    const first = res.body.find(
      (i: { chaletId: string }) => i.chaletId === chaletIds[0],
    );
    expect(first.status).toBe('PARTIAL');
    expect(first.paidCents).toBe(10000);
  });

  it('gera o relatório do evento', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/reports/events/${eventId}`)
      .set(auth())
      .expect(200);

    // Soma as 5 entradas: 2+3+1 adultos das primeiras, mais 2 e 1 das outras
    // duas entradas do chalé 0.
    expect(res.body.guests).toEqual({
      adults: 9,
      children: 3,
      alcoholConsumers: 4,
    });
    expect(res.body.totalCents).toBe(107001);
    expect(res.body.settlement).toHaveLength(3);
  });

  it('nega acesso sem token', async () => {
    await request(app.getHttpServer()).get('/api/events').expect(401);
  });
});
