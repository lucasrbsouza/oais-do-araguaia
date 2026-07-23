import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ChaletStatus, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../../shared/domain/domain-error';
import { AuthenticatedUser } from '../../../../shared/infrastructure/auth/decorators';
import { UserRepository } from '../../../users/domain/user.repository';
import {
  ChaletMemberDetail,
  ChaletRepository,
} from '../../domain/chalet.repository';
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
    const isOwnerOrMember =
      chalet.ownerId === user.id ||
      (await this.chaletRepository.isOwnerOrMember(user.id, chalet.id));

    if (!isAdmin && !isOwnerOrMember) {
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

@Injectable()
export class ListChaletMembersUseCase {
  constructor(private readonly chaletRepository: ChaletRepository) {}

  async execute(
    chaletId: string,
    user: AuthenticatedUser,
  ): Promise<ChaletMemberDetail[]> {
    const chalet = await this.chaletRepository.findById(chaletId);
    if (!chalet) {
      throw new NotFoundError('Chalé não encontrado.');
    }
    const isAdmin = user.role === Role.ADMIN;
    const isOwnerOrMember =
      chalet.ownerId === user.id ||
      (await this.chaletRepository.isOwnerOrMember(user.id, chalet.id));

    if (!isAdmin && !isOwnerOrMember) {
      throw new ForbiddenError(
        'Você só pode ver os membros do seu próprio chalé.',
      );
    }
    return this.chaletRepository.listMembers(chaletId);
  }
}

export interface AddChaletMemberInput {
  chaletId: string;
  userId?: string;
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
}

@Injectable()
export class AddChaletMemberUseCase {
  constructor(
    private readonly chaletRepository: ChaletRepository,
    @Inject(forwardRef(() => UserRepository))
    private readonly userRepository: UserRepository,
  ) {}

  async execute(
    input: AddChaletMemberInput,
    user: AuthenticatedUser,
  ): Promise<{ id: string; name: string; email: string }> {
    const chalet = await this.chaletRepository.findById(input.chaletId);
    if (!chalet) {
      throw new NotFoundError('Chalé não encontrado.');
    }
    const isAdmin = user.role === Role.ADMIN;
    const isOwner = chalet.ownerId === user.id;
    if (!isAdmin && !isOwner) {
      throw new ForbiddenError(
        'Somente o proprietário ou administrador pode adicionar familiares.',
      );
    }

    const currentCount = await this.chaletRepository.countMembers(
      input.chaletId,
    );
    if (currentCount >= 4) {
      throw new ConflictError(
        'Este chalé já atingiu o limite de 5 usuários (1 dono + 4 familiares).',
      );
    }

    let targetUser: { id: string; name: string; email: string } | null = null;

    if (input.userId) {
      const existingUser = await this.userRepository.findById(input.userId);
      if (!existingUser) {
        throw new NotFoundError('Usuário não encontrado.');
      }
      targetUser = existingUser;
    } else if (input.email) {
      const existingUser = await this.userRepository.findByEmail(input.email);
      if (existingUser) {
        targetUser = existingUser;
      } else {
        if (!input.name || !input.password) {
          throw new ConflictError('Nome e senha são obrigatórios para criar novo usuário.');
        }
        const nameTaken = await this.userRepository.findByName(input.name);
        if (nameTaken) {
          throw new ConflictError('Já existe um usuário com este nome.');
        }
        const passwordHash = await argon2.hash(input.password, {
          type: argon2.argon2id,
        });
        const createdUser = await this.userRepository.create({
          name: input.name,
          email: input.email,
          passwordHash,
          role: Role.OWNER,
          phone: input.phone ?? null,
          mustChangePassword: true,
        });
        targetUser = createdUser;
      }
    } else {
      throw new ConflictError('Informe um usuário existente ou dados para cadastro.');
    }

    if (chalet.ownerId === targetUser.id) {
      throw new ConflictError(
        'O proprietário do chalé não pode ser adicionado como familiar.',
      );
    }

    const isAlreadyMember = await this.chaletRepository.isOwnerOrMember(
      targetUser.id,
      input.chaletId,
    );
    if (isAlreadyMember) {
      throw new ConflictError('Este usuário já é membro deste chalé.');
    }

    await this.chaletRepository.addMember(input.chaletId, targetUser.id);
    return { id: targetUser.id, name: targetUser.name, email: targetUser.email };
  }
}

@Injectable()
export class RemoveChaletMemberUseCase {
  constructor(private readonly chaletRepository: ChaletRepository) {}

  async execute(
    chaletId: string,
    memberUserId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const chalet = await this.chaletRepository.findById(chaletId);
    if (!chalet) {
      throw new NotFoundError('Chalé não encontrado.');
    }
    const isAdmin = user.role === Role.ADMIN;
    const isOwner = chalet.ownerId === user.id;
    if (!isAdmin && !isOwner) {
      throw new ForbiddenError(
        'Somente o proprietário ou administrador pode remover familiares.',
      );
    }
    await this.chaletRepository.removeMember(chaletId, memberUserId);
  }
}
