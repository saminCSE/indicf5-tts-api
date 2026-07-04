process.env.MONGO_URI = 'mongodb://localhost:27017/indicf5-tts-test';
process.env.TTS_BACKEND = 'mock';
process.env.BULL_PREFIX = 'bull-test-rl';
process.env.RATE_LIMIT_PER_MINUTE = '3';

import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type Redis from 'ioredis';
import { Connection } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { REDIS_CLIENT } from '../src/database/redis/redis.module';

async function clearRateLimitKeys(redis: Redis) {
  const keys = await redis.keys('ratelimit:*');
  if (keys.length) await redis.del(...keys);
}

describe('Rate limiting (e2e)', () => {
  let app: INestApplication;
  let connection: Connection;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let keyA: string;
  let keyB: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer();

    connection = app.get<Connection>(getConnectionToken());
    await connection.dropDatabase();
    await clearRateLimitKeys(app.get<Redis>(REDIS_CLIENT));

    const a = await request(server)
      .post('/v1/auth/register')
      .send({ email: 'rl-a@example.com', name: 'RL A' });
    keyA = a.body.data.apiKey;

    const b = await request(server)
      .post('/v1/auth/register')
      .send({ email: 'rl-b@example.com', name: 'RL B' });
    keyB = b.body.data.apiKey;
  });

  afterAll(async () => {
    await connection.dropDatabase();
    await app.close();
  });

  it('allows up to the limit then returns 429 with Retry-After', async () => {
    for (let i = 0; i < 3; i++) {
      await request(server).get('/v1/me').set('x-api-key', keyA).expect(200);
    }
    const res = await request(server)
      .get('/v1/me')
      .set('x-api-key', keyA)
      .expect(429);

    expect(res.headers['retry-after']).toBeDefined();
    expect(res.body.success).toBe(false);
    expect(res.body.statusCode).toBe(429);
  });

  it('does not throttle other users when one is limited', async () => {
    await request(server).get('/v1/me').set('x-api-key', keyB).expect(200);
  });

  it('exposes X-RateLimit headers that count down', async () => {
    const first = await request(server)
      .get('/v1/me')
      .set('x-api-key', keyB);
    const second = await request(server)
      .get('/v1/me')
      .set('x-api-key', keyB);

    expect(first.headers['x-ratelimit-limit']).toBe('3');
    expect(
      Number(second.headers['x-ratelimit-remaining']),
    ).toBeLessThan(Number(first.headers['x-ratelimit-remaining']));
  });

  it('never throttles the health endpoint', async () => {
    for (let i = 0; i < 6; i++) {
      await request(server).get('/v1/health').expect(200);
    }
  });
});
