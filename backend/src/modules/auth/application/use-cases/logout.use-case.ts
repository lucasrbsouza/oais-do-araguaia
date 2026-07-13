import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../audit/audit.service';
import { RefreshTokenRepository } from '../../domain/refresh-token.repository';
import { TokenService } from '../token.service';

@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
  ) {}

  async execute(rawToken: string | undefined, ip?: string): Promise<void> {
    if (!rawToken) return;
    const stored = await this.refreshTokenRepository.findByHash(
      this.tokenService.hashRefreshToken(rawToken),
    );
    if (stored && !stored.revokedAt) {
      await this.refreshTokenRepository.revoke(stored.id);
      await this.auditService.log({
        userId: stored.userId,
        action: 'AUTH_LOGOUT',
        entity: 'Auth',
        entityId: stored.userId,
        ip,
      });
    }
  }
}
