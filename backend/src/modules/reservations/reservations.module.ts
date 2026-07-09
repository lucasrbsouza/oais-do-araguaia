import { Module } from '@nestjs/common';
import { ChaletsModule } from '../chalets/chalets.module';
import { EventsModule } from '../events/events.module';
import {
  CancelReservationUseCase,
  CreateReservationUseCase,
  ListReservationsUseCase,
  UpdateReservationUseCase,
} from './application/use-cases/manage-reservation.use-cases';
import { ReservationRepository } from './domain/reservation.repository';
import { PrismaReservationRepository } from './infrastructure/prisma-reservation.repository';
import { ReservationsController } from './presentation/reservations.controller';

@Module({
  imports: [EventsModule, ChaletsModule],
  controllers: [ReservationsController],
  providers: [
    { provide: ReservationRepository, useClass: PrismaReservationRepository },
    CreateReservationUseCase,
    UpdateReservationUseCase,
    CancelReservationUseCase,
    ListReservationsUseCase,
  ],
  exports: [ReservationRepository],
})
export class ReservationsModule {}
