import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import {
  NotFoundError,
  UnauthorizedError,
} from '../../../../shared/domain/domain-error';
import { FileStorage } from '../../../purchases/domain/file-storage';
import { UserRepository } from '../../domain/user.repository';
import { toUserResponse, UserResponse } from '../user.mapper';
import { UpdateUserUseCase } from './update-user.use-case';

export interface UpdateProfileInput {
  userId: string;
  name?: string;
  email?: string;
  phone?: string | null;
}

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

@Injectable()
export class GetUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: string): Promise<UserResponse> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('Usuário não encontrado.');
    }
    return toUserResponse(user);
  }
}

@Injectable()
export class UpdateProfileUseCase {
  constructor(private readonly updateUser: UpdateUserUseCase) {}

  execute(input: UpdateProfileInput): Promise<UserResponse> {
    // Reutiliza as validações de conflito de nome/e-mail do update de admin,
    // restringindo aos campos que o próprio usuário pode alterar.
    return this.updateUser.execute({
      id: input.userId,
      name: input.name,
      email: input.email,
      phone: input.phone,
    });
  }
}

@Injectable()
export class ChangePasswordUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: ChangePasswordInput): Promise<UserResponse> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new NotFoundError('Usuário não encontrado.');
    }

    const matches = await argon2.verify(
      user.passwordHash,
      input.currentPassword,
    );
    if (!matches) {
      throw new UnauthorizedError('Senha atual incorreta.');
    }

    const passwordHash = await argon2.hash(input.newPassword, {
      type: argon2.argon2id,
    });
    const updated = await this.userRepository.update(user.id, {
      passwordHash,
      mustChangePassword: false,
    });
    return toUserResponse(updated);
  }
}

@Injectable()
export class SetAvatarUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly fileStorage: FileStorage,
  ) {}

  async execute(
    userId: string,
    buffer: Buffer,
    originalName: string,
  ): Promise<UserResponse> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('Usuário não encontrado.');
    }

    if (user.avatarPath) {
      await this.fileStorage.delete(user.avatarPath);
    }
    const stored = await this.fileStorage.save(buffer, originalName);
    const updated = await this.userRepository.update(userId, {
      avatarPath: stored.path,
    });
    return toUserResponse(updated);
  }
}

@Injectable()
export class GetAvatarUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly fileStorage: FileStorage,
  ) {}

  async execute(userId: string): Promise<string> {
    const user = await this.userRepository.findById(userId);
    if (!user?.avatarPath) {
      throw new NotFoundError('Usuário sem foto de perfil.');
    }
    return this.fileStorage.resolve(user.avatarPath);
  }
}
