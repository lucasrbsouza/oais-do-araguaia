import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  ConflictError,
  NotFoundError,
} from '../../../../shared/domain/domain-error';
import { UserRepository } from '../../domain/user.repository';
import { toUserResponse, UserResponse } from '../user.mapper';

export interface UpdateUserInput {
  id: string;
  name?: string;
  email?: string;
  role?: Role;
  active?: boolean;
  password?: string;
  phone?: string | null;
}

@Injectable()
export class UpdateUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: UpdateUserInput): Promise<UserResponse> {
    const user = await this.userRepository.findById(input.id);
    if (!user) {
      throw new NotFoundError('Usuário não encontrado.');
    }

    if (input.email && input.email !== user.email) {
      const emailTaken = await this.userRepository.findByEmail(input.email);
      if (emailTaken) {
        throw new ConflictError('Já existe um usuário com este e-mail.');
      }
    }

    if (input.name && input.name !== user.name) {
      const nameTaken = await this.userRepository.findByName(input.name);
      if (nameTaken && nameTaken.id !== user.id) {
        throw new ConflictError('Já existe um usuário com este nome.');
      }
    }

    const passwordHash = input.password
      ? await argon2.hash(input.password, { type: argon2.argon2id })
      : undefined;

    const updated = await this.userRepository.update(input.id, {
      name: input.name,
      email: input.email,
      role: input.role,
      active: input.active,
      passwordHash,
      phone: input.phone,
    });
    return toUserResponse(updated);
  }
}
