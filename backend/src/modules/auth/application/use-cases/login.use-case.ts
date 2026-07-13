import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { UnauthorizedError } from '../../../../shared/domain/domain-error';
import { AuditService } from '../../../audit/audit.service';
import {
  toUserResponse,
  UserResponse,
} from '../../../users/application/user.mapper';
import { UserRepository } from '../../../users/domain/user.repository';
import { RefreshTokenRepository } from '../../domain/refresh-token.repository';
import { TokenService } from '../token.service';

export interface LoginInput {
  email: string;
  password: string;
  ip?: string;
}

export interface LoginOutput {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: UserResponse;
}

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const user = await this.userRepository.findByEmail(input.email);
    if (!user || !user.active) {
      await this.logFailure(input.email, input.ip);
      throw new UnauthorizedError('Credenciais inválidas.');
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      input.password,
    );
    if (!passwordMatches) {
      await this.logFailure(input.email, input.ip);
      throw new UnauthorizedError('Credenciais inválidas.');
    }

    await this.auditService.log({
      userId: user.id,
      action: 'AUTH_LOGIN',
      entity: 'Auth',
      entityId: user.id,
      ip: input.ip,
    });

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

  private logFailure(email: string, ip?: string): Promise<void> {
    return this.auditService.log({
      action: 'AUTH_LOGIN_FAILED',
      entity: 'Auth',
      metadata: { email },
      ip,
    });
  }
}
