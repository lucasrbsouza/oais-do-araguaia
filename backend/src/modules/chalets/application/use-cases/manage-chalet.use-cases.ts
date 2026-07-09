import { Injectable } from '@nestjs/common';
import { ChaletStatus, Role } from '@prisma/client';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../../shared/domain/domain-error';
import { AuthenticatedUser } from '../../../../shared/infrastructure/auth/decorators';
import { UserRepository } from '../../../users/domain/user.repository';
import { ChaletRepository } from '../../domain/chalet.repository';
import { ChaletResponse, toChaletResponse } from '../chalet.mapper';

export interface CreateChaletInput {
  number: number;
  name: string;
  ownerId?: string;
}

export interface UpdateChaletInput {
  id: string;
  name?: string;
  ownerId?: string | null;
  status?: ChaletStatus;
}

@Injectable()
export class CreateChaletUseCase {
  constructor(
    private readonly chaletRepository: ChaletRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(input: CreateChaletInput): Promise<ChaletResponse> {
    const existing = await this.chaletRepository.findByNumber(input.number);
    if (existing) {
      throw new ConflictError(
        `Já existe um chalé com o número ${input.number}.`,
      );
    }
    if (input.ownerId) {
      const owner = await this.userRepository.findById(input.ownerId);
      if (!owner) {
        throw new NotFoundError('Proprietário não encontrado.');
      }
    }
    const chalet = await this.chaletRepository.create(input);
    return toChaletResponse(chalet);
  }
}

@Injectable()
export class UpdateChaletUseCase {
  constructor(
    private readonly chaletRepository: ChaletRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(
    input: UpdateChaletInput,
    user: AuthenticatedUser,
  ): Promise<ChaletResponse> {
    const chalet = await this.chaletRepository.findById(input.id);
    if (!chalet) {
      throw new NotFoundError('Chalé não encontrado.');
    }

    const isAdmin = user.role === Role.ADMIN;
    if (!isAdmin && chalet.ownerId !== user.id) {
      throw new ForbiddenError('Você só pode editar o seu próprio chalé.');
    }
    if (!isAdmin && input.ownerId !== undefined) {
      throw new ForbiddenError(
        'Somente administradores podem alterar o proprietário do chalé.',
      );
    }

    if (input.ownerId) {
      const owner = await this.userRepository.findById(input.ownerId);
      if (!owner) {
        throw new NotFoundError('Proprietário não encontrado.');
      }
    }
    const updated = await this.chaletRepository.update(input.id, {
      name: input.name,
      ownerId: input.ownerId,
      status: input.status,
    });
    return toChaletResponse(updated);
  }
}

@Injectable()
export class DeleteChaletUseCase {
  constructor(private readonly chaletRepository: ChaletRepository) {}

  async execute(id: string): Promise<void> {
    const chalet = await this.chaletRepository.findById(id);
    if (!chalet) {
      throw new NotFoundError('Chalé não encontrado.');
    }
    const hasHistory = await this.chaletRepository.hasHistory(id);
    if (hasHistory) {
      throw new ConflictError(
        'Este chalé possui reservas, rateios ou pagamentos e não pode ser excluído.',
      );
    }
    await this.chaletRepository.delete(id);
  }
}

@Injectable()
export class ListChaletsUseCase {
  constructor(private readonly chaletRepository: ChaletRepository) {}

  async execute(): Promise<ChaletResponse[]> {
    const chalets = await this.chaletRepository.list();
    return chalets.map(toChaletResponse);
  }
}
