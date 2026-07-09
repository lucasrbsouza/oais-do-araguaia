import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { ConflictError } from '../../../../shared/domain/domain-error';
import { UserRepository } from '../../domain/user.repository';
import { toUserResponse, UserResponse } from '../user.mapper';

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
}

@Injectable()
export class CreateUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: CreateUserInput): Promise<UserResponse> {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictError('Já existe um usuário com este e-mail.');
    }

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });
    const user = await this.userRepository.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
    });
    return toUserResponse(user);
  }
}
