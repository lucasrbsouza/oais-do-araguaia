import { forwardRef, Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import {
  AddChaletMemberUseCase,
  CreateChaletUseCase,
  DeleteChaletUseCase,
  ListChaletMembersUseCase,
  ListChaletsUseCase,
  RemoveChaletMemberUseCase,
  UpdateChaletUseCase,
} from './application/use-cases/manage-chalet.use-cases';
import { ChaletRepository } from './domain/chalet.repository';
import { ChaletOccupancyQuery } from './infrastructure/chalet-occupancy.query';
import { PrismaChaletRepository } from './infrastructure/prisma-chalet.repository';
import { ChaletsController } from './presentation/chalets.controller';

@Module({
  imports: [forwardRef(() => UsersModule)],
  controllers: [ChaletsController],
  providers: [
    { provide: ChaletRepository, useClass: PrismaChaletRepository },
    ChaletOccupancyQuery,
    CreateChaletUseCase,
    UpdateChaletUseCase,
    DeleteChaletUseCase,
    ListChaletsUseCase,
    ListChaletMembersUseCase,
    AddChaletMemberUseCase,
    RemoveChaletMemberUseCase,
  ],
  exports: [ChaletRepository],
})
export class ChaletsModule {}
