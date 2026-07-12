import { Module } from '@nestjs/common';
import { FileStorage } from '../purchases/domain/file-storage';
import { LocalFileStorage } from '../purchases/infrastructure/local-file-storage';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { DeleteUserUseCase } from './application/use-cases/delete-user.use-case';
import { ListUsersUseCase } from './application/use-cases/list-users.use-case';
import {
  ChangePasswordUseCase,
  GetAvatarUseCase,
  GetUserUseCase,
  SetAvatarUseCase,
  UpdateProfileUseCase,
} from './application/use-cases/manage-profile.use-cases';
import { UpdateUserUseCase } from './application/use-cases/update-user.use-case';
import { UserRepository } from './domain/user.repository';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { UsersController } from './presentation/users.controller';

@Module({
  controllers: [UsersController],
  providers: [
    { provide: UserRepository, useClass: PrismaUserRepository },
    { provide: FileStorage, useClass: LocalFileStorage },
    CreateUserUseCase,
    UpdateUserUseCase,
    ListUsersUseCase,
    DeleteUserUseCase,
    GetUserUseCase,
    UpdateProfileUseCase,
    ChangePasswordUseCase,
    SetAvatarUseCase,
    GetAvatarUseCase,
  ],
  exports: [UserRepository],
})
export class UsersModule {}
