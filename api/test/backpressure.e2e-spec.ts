process.env.MONGO_URI = 'mongodb://localhost:27017/indicf5-tts-test';
process.env.TTS_BACKEND = 'mock';
process.env.RATE_LIMIT_PER_MINUTE = '10000';
process.env.BULL_PREFIX = 'bull-test-bp';
process.env.QUEUE_MAX_DEPTH = '0';

import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Connection } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

describe('Queue backpressure (e2e)', () => {
  let app: INestApplication;
  let connection: Connection;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let key: string;

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

    const res = await request(server)
      .post('/v1/auth/register')
      .send({ email: 'bp@example.com', name: 'BP' });
    key = res.body.data.apiKey;
  });

  afterAll(async () => {
    await connection.dropDatabase();
    await app.close();
  });

  it('rejects submissions with 503 and Retry-After when the queue is saturated', async () => {
    const res = await request(server)
      .post('/v1/tts')
      .set('x-api-key', key)
      .send({ text: 'আমার সোনার বাংলা' })
      .expect(503);

    expect(res.headers['retry-after']).toBe('30');
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Queue is full');
  });

  it('does not create a job document for rejected submissions', async () => {
    const before = await connection.collection('jobs').countDocuments();
    await request(server)
      .post('/v1/tts')
      .set('x-api-key', key)
      .send({ text: 'আমার সোনার বাংলা' })
      .expect(503);
    const after = await connection.collection('jobs').countDocuments();
    expect(after).toBe(before);
  });
});
