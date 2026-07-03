process.env.MONGO_URI = 'mongodb://localhost:27017/indicf5-tts-test';

import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Connection } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let connection: Connection;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    connection = app.get<Connection>(getConnectionToken());
    await connection.dropDatabase();
  });

  afterAll(async () => {
    await connection.dropDatabase();
    await app.close();
  });

  describe('POST /v1/auth/register', () => {
    it('returns 201 with a tts_live_ prefixed key and no hash', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: 'alice@example.com', name: 'Alice' })
        .expect(201);

      expect(res.body.data.apiKey).toMatch(/^tts_live_/);
      expect(res.body.data.keyPrefix).toBe(res.body.data.apiKey.slice(0, 12));
      expect(res.body.data.keyHash).toBeUndefined();
    });

    it('returns 409 for a duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: 'alice@example.com', name: 'Alice Again' })
        .expect(409);
    });

    it('returns 400 for an invalid email', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: 'not-an-email', name: 'Bob' })
        .expect(400);
    });

    it('returns 400 for unknown extra fields', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: 'bob@example.com', name: 'Bob', role: 'admin' })
        .expect(400);
    });

    it('stores only a hash of the key, never the raw key', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: 'carol@example.com', name: 'Carol' })
        .expect(201);

      const stored = await connection
        .collection('apikeys')
        .findOne({ keyPrefix: res.body.data.apiKey.slice(0, 12) });

      expect(stored).not.toBeNull();
      expect(stored!.keyHash).toBeDefined();
      expect(stored!.keyHash).not.toBe(res.body.data.apiKey);
      expect(JSON.stringify(stored)).not.toContain(res.body.data.apiKey);
    });
  });

  describe('GET /v1/me', () => {
    let validKey: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: 'dave@example.com', name: 'Dave' });
      validKey = res.body.data.apiKey;
    });

    it('returns 401 without an api key', async () => {
      await request(app.getHttpServer()).get('/v1/me').expect(401);
    });

    it('returns 401 with an unknown api key', async () => {
      await request(app.getHttpServer())
        .get('/v1/me')
        .set('x-api-key', 'tts_live_garbage')
        .expect(401);
    });

    it('returns the authenticated user with a valid key', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/me')
        .set('x-api-key', validKey)
        .expect(200);

      expect(res.body.data.email).toBe('dave@example.com');
      expect(res.body.data.name).toBe('Dave');
      expect(res.body.data.keyPrefix).toBe(validKey.slice(0, 12));
    });

    it('health stays public', async () => {
      await request(app.getHttpServer()).get('/v1/health').expect(200);
    });
  });
});
