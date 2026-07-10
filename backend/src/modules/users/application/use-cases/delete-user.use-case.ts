import { Injectable } from '@nestjs/common';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../../shared/domain/domain-error';
import { UserRepository } from '../../domain/user.repository';

export interface DeleteUserInput {
  id: string;
  currentUserId: string;
}

@Injectable()
export class DeleteUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: DeleteUserInput): Promise<void> {
    if (input.id === input.currentUserId) {
      throw new ForbiddenError('Você não pode excluir o próprio usuário.');
    }

    const user = await this.userRepository.findById(input.id);
    if (!user) {
      throw new NotFoundError('Usuário não encontrado.');
    }

    const hasHistory = await this.userRepository.hasHistory(input.id);
    if (hasHistory) {
      throw new ConflictError(
        'Este usuário possui chalés, reservas, compras ou pagamentos vinculados e não pode ser excluído. Desative-o em vez disso.',
      );
    }

    await this.userRepository.delete(input.id);
  }
}
