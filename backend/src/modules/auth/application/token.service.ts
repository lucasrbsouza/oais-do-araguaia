import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { createHmac, randomBytes } from 'node:crypto';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async issueAccessToken(user: User): Promise<string> {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  }

  generateRefreshToken(): { token: string; expiresAt: Date } {
    const days = this.config.getOrThrow<number>('JWT_REFRESH_TTL_DAYS');
    return {
      token: randomBytes(48).toString('hex'),
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    };
  }

  hashRefreshToken(token: string): string {
    const secret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    return createHmac('sha256', secret).update(token).digest('hex');
  }
}
