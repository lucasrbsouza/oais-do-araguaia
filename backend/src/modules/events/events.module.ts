import { Module } from '@nestjs/common';
import { SettlementModule } from '../settlement/settlement.module';
import {
  CancelEventUseCase,
  CloseEventUseCase,
  CreateEventUseCase,
  DeleteEventUseCase,
  GetEventUseCase,
  ListEventsUseCase,
  ReopenEventUseCase,
  UpdateEventUseCase,
} from './application/use-cases/manage-event.use-cases';
import { EventRepository } from './domain/event.repository';
import { PrismaEventRepository } from './infrastructure/prisma-event.repository';
import { EventsController } from './presentation/events.controller';

@Module({
  imports: [SettlementModule],
  controllers: [EventsController],
  providers: [
    { provide: EventRepository, useClass: PrismaEventRepository },
    CreateEventUseCase,
    ListEventsUseCase,
    GetEventUseCase,
    CloseEventUseCase,
    ReopenEventUseCase,
    UpdateEventUseCase,
    CancelEventUseCase,
    DeleteEventUseCase,
  ],
  exports: [EventRepository],
})
export class EventsModule {}
