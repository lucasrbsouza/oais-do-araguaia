import { Injectable } from '@nestjs/common';
import { UnauthorizedError } from '../../../../shared/domain/domain-error';
import { toUserResponse } from '../../../users/application/user.mapper';
import { UserRepository } from '../../../users/domain/user.repository';
import { RefreshTokenRepository } from '../../domain/refresh-token.repository';
import { TokenService } from '../token.service';
import { LoginOutput } from './login.use-case';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(rawToken: string): Promise<LoginOutput> {
    const stored = await this.refreshTokenRepository.findByHash(
      this.tokenService.hashRefreshToken(rawToken),
    );
    if (!stored) {
      throw new UnauthorizedError('Sessão inválida. Faça login novamente.');
    }

    if (stored.revokedAt) {
      // Reuso de token já rotacionado: possível roubo — revoga todas as sessões.
      await this.refreshTokenRepository.revokeAllForUser(stored.userId);
      throw new UnauthorizedError('Sessão inválida. Faça login novamente.');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Sessão expirada. Faça login novamente.');
    }

    const user = await this.userRepository.findById(stored.userId);
    if (!user || !user.active) {
      throw new UnauthorizedError('Sessão inválida. Faça login novamente.');
    }

    await this.refreshTokenRepository.revoke(stored.id);
    const accessToken = await this.tokenService.issueAccessToken(user);
    const { token: refreshToken, expiresAt } =
      this.tokenService.generateRefreshToken();
    await this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash: this.tokenService.hashRefreshToken(refreshToken),
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
      user: toUserResponse(user),
    };
  }
}
