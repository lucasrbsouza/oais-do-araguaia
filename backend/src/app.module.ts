import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChaletsModule } from './modules/chalets/chalets.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EventsModule } from './modules/events/events.module';
import { HealthModule } from './modules/health/health.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { SettlementModule } from './modules/settlement/settlement.module';
import { UsersModule } from './modules/users/users.module';
import { JwtAuthGuard } from './shared/infrastructure/auth/jwt-auth.guard';
import { RolesGuard } from './shared/infrastructure/auth/roles.guard';
import { validateEnv } from './shared/infrastructure/config/env';
import { PrismaModule } from './shared/infrastructure/database/prisma.module';
import {
  CORRELATION_ID_HEADER,
  CorrelationIdMiddleware,
} from './shared/infrastructure/http/correlation-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req) =>
          (req.headers[CORRELATION_ID_HEADER] as string) ?? randomUUID(),
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty' }
            : undefined,
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    HealthModule,
    AuditModule,
    AuthModule,
    UsersModule,
    ChaletsModule,
    EventsModule,
    ReservationsModule,
    PurchasesModule,
    SettlementModule,
    PaymentsModule,
    ReportsModule,
    DashboardModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
