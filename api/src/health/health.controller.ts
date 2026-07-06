import { Controller, Get, Inject } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type Redis from 'ioredis';
import { Connection, ConnectionStates } from 'mongoose';
import { Public } from '../auth/decorators/public.decorator';
import { SkipRateLimit } from '../common/decorators/skip-rate-limit.decorator';
import { REDIS_CLIENT } from '../database/redis/redis.module';

@Public()
@SkipRateLimit()
@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  check() {
    const mongoConnected =
      this.connection.readyState === ConnectionStates.connected;
    const redisConnected = this.redis.status === 'ready';
    return {
      status: mongoConnected && redisConnected ? 'ok' : 'degraded',
      mongo: mongoConnected ? 'connected' : 'disconnected',
      redis: redisConnected ? 'connected' : 'disconnected',
      uptime: this.formatUptime(process.uptime()),
    };
  }

  private formatUptime(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
  }
}
