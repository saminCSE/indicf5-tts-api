import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type Redis from 'ioredis';
import type { AuthenticatedUser } from '../../auth/decorators/current-user.decorator';
import { REDIS_CLIENT } from '../../database/redis/redis.module';
import { SKIP_RATE_LIMIT_KEY } from '../decorators/skip-rate-limit.decorator';

const WINDOW_MS = 60_000;

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly limit: number;

  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    config: ConfigService,
  ) {
    this.limit = config.get<number>('rateLimitPerMinute') ?? 60;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return true;

    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: AuthenticatedUser }>();
    const res = http.getResponse<Response>();

    const principal = req.user?.userId ?? `ip:${req.ip ?? 'unknown'}`;
    const key = `ratelimit:${principal}`;
    const now = Date.now();

    try {
      const [, [, count]] = (await this.redis
        .pipeline()
        .zremrangebyscore(key, 0, now - WINDOW_MS)
        .zcard(key)
        .exec()) as [unknown, [unknown, number]];

      res.setHeader('X-RateLimit-Limit', this.limit);

      if (count >= this.limit) {
        const oldest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
        const oldestTs = oldest.length ? Number(oldest[1]) : now;
        const retryAfterSec = Math.max(
          1,
          Math.ceil((oldestTs + WINDOW_MS - now) / 1000),
        );
        res.setHeader('Retry-After', retryAfterSec);
        res.setHeader('X-RateLimit-Remaining', 0);
        throw new HttpException(
          {
            message: 'Rate limit exceeded, slow down',
            error: 'Too Many Requests',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      await this.redis
        .pipeline()
        .zadd(key, now, `${now}:${Math.random()}`)
        .pexpire(key, WINDOW_MS)
        .exec();

      res.setHeader('X-RateLimit-Remaining', this.limit - count - 1);
      return true;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(
        `Redis unavailable for rate limiting, failing open: ${String(err)}`,
      );
      return true;
    }
  }
}
