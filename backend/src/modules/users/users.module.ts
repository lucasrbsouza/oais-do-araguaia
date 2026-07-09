import { Module } from '@nestjs/common';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { ListUsersUseCase } from './application/use-cases/list-users.use-case';
import { UpdateUserUseCase } from './application/use-cases/update-user.use-case';
import { UserRepository } from './domain/user.repository';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { UsersController } from './presentation/users.controller';

@Module({
  controllers: [UsersController],
  providers: [
    { provide: UserRepository, useClass: PrismaUserRepository },
    CreateUserUseCase,
    UpdateUserUseCase,
    ListUsersUseCase,
  ],
  exports: [UserRepository],
})
export class UsersModule {}
