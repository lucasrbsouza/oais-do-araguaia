import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { ConflictError, NotFoundError } from '../../../../shared/domain/domain-error';
import { ChaletRepository } from '../../../chalets/domain/chalet.repository';
import { UserRepository } from '../../domain/user.repository';
import { toUserResponse, UserResponse } from '../user.mapper';

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  phone?: string;
  memberChaletId?: string;
}

@Injectable()
export class CreateUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    @Inject(forwardRef(() => ChaletRepository))
    private readonly chaletRepository?: ChaletRepository,
  ) {}

  async execute(input: CreateUserInput): Promise<UserResponse> {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictError('Já existe um usuário com este e-mail.');
    }

    const nameTaken = await this.userRepository.findByName(input.name);
    if (nameTaken) {
      throw new ConflictError('Já existe um usuário com este nome.');
    }

    if (input.memberChaletId && this.chaletRepository) {
      const chalet = await this.chaletRepository.findById(input.memberChaletId);
      if (!chalet) {
        throw new NotFoundError('Chalé não encontrado.');
      }
      const count = await this.chaletRepository.countMembers(input.memberChaletId);
      if (count >= 4) {
        throw new ConflictError(
          'Este chalé já atingiu o limite de 5 usuários (1 dono + 4 familiares).',
        );
      }
    }

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });
    const user = await this.userRepository.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      phone: input.phone ?? null,
      // Usuário criado pelo admin deve trocar a senha no primeiro acesso.
      mustChangePassword: true,
    });

    if (input.memberChaletId && this.chaletRepository) {
      await this.chaletRepository.addMember(input.memberChaletId, user.id);
    }

    return toUserResponse(user);
  }
}
