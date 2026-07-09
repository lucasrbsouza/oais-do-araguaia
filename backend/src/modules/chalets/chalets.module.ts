import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import {
  CreateChaletUseCase,
  DeleteChaletUseCase,
  ListChaletsUseCase,
  UpdateChaletUseCase,
} from './application/use-cases/manage-chalet.use-cases';
import { ChaletRepository } from './domain/chalet.repository';
import { PrismaChaletRepository } from './infrastructure/prisma-chalet.repository';
import { ChaletsController } from './presentation/chalets.controller';

@Module({
  imports: [UsersModule],
  controllers: [ChaletsController],
  providers: [
    { provide: ChaletRepository, useClass: PrismaChaletRepository },
    CreateChaletUseCase,
    UpdateChaletUseCase,
    DeleteChaletUseCase,
    ListChaletsUseCase,
  ],
  exports: [ChaletRepository],
})
export class ChaletsModule {}
