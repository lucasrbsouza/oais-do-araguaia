import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Response } from 'express';
import { Public } from '../../shared/infrastructure/auth/decorators';
import { PrismaService } from '../../shared/infrastructure/database/prisma.service';

type ServiceState = 'up' | 'down';

interface HealthReport {
  status: 'ok' | 'error';
  services: { database: ServiceState; redis: ServiceState };
  timestamp: string;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @Public()
  async check(
    @Res({ passthrough: true }) res: Response,
  ): Promise<HealthReport> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);
    const healthy = database === 'up' && redis === 'up';
    res.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: healthy ? 'ok' : 'error',
      services: { database, redis },
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<ServiceState> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<ServiceState> {
    const redis = new Redis(this.config.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
    });
    try {
      await redis.connect();
      await redis.ping();
      return 'up';
    } catch {
      return 'down';
    } finally {
      redis.disconnect();
    }
  }
}
