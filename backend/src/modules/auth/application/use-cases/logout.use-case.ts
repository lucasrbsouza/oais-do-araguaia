import { Injectable } from '@nestjs/common';
import { RefreshTokenRepository } from '../../domain/refresh-token.repository';
import { TokenService } from '../token.service';

@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const stored = await this.refreshTokenRepository.findByHash(
      this.tokenService.hashRefreshToken(rawToken),
    );
    if (stored && !stored.revokedAt) {
      await this.refreshTokenRepository.revoke(stored.id);
    }
  }
}
