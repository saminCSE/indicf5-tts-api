process.env.MONGO_URI = 'mongodb://localhost:27017/indicf5-tts-test';
process.env.TTS_BACKEND = 'mock';
process.env.BULL_PREFIX = 'bull-test';

import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import { Connection } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

const BENGALI_TEXT = 'আমার সোনার বাংলা, আমি তোমায় ভালোবাসি।';

describe('TTS Jobs (e2e)', () => {
  let app: INestApplication;
  let connection: Connection;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let keyA: string;
  let keyB: string;

  async function submitJob(key: string, text = BENGALI_TEXT) {
    const res = await request(server)
      .post('/v1/tts')
      .set('x-api-key', key)
      .send({ text })
      .expect(202);
    return res.body.data.jobId as string;
  }

  async function waitForStatus(
    key: string,
    jobId: string,
    status: string,
    timeoutMs = 10000,
  ) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const res = await request(server)
        .get(`/v1/jobs/${jobId}`)
        .set('x-api-key', key);
      if (res.body.data?.status === status) return res.body.data;
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error(`timed out waiting for status ${status}`);
  }

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

    const queue = app.get<Queue>(getQueueToken('tts'));
    await queue.obliterate({ force: true });

    const a = await request(server)
      .post('/v1/auth/register')
      .send({ email: 'user-a@example.com', name: 'User A' });
    keyA = a.body.data.apiKey;

    const b = await request(server)
      .post('/v1/auth/register')
      .send({ email: 'user-b@example.com', name: 'User B' });
    keyB = b.body.data.apiKey;
  });

  afterAll(async () => {
    await connection.dropDatabase();
    await app.close();
  });

  describe('POST /v1/tts', () => {
    it('accepts Bengali text and returns 202 with a queued job', async () => {
      const res = await request(server)
        .post('/v1/tts')
        .set('x-api-key', keyA)
        .send({ text: BENGALI_TEXT })
        .expect(202);

      expect(res.body.data.jobId).toBeDefined();
      expect(res.body.data.status).toBe('queued');
    });

    it('rejects empty text with 400', async () => {
      await request(server)
        .post('/v1/tts')
        .set('x-api-key', keyA)
        .send({ text: '' })
        .expect(400);
    });

    it('rejects text over the char limit with 400', async () => {
      await request(server)
        .post('/v1/tts')
        .set('x-api-key', keyA)
        .send({ text: 'আ'.repeat(1001) })
        .expect(400);
    });

    it('rejects text with no Bengali characters with 422', async () => {
      await request(server)
        .post('/v1/tts')
        .set('x-api-key', keyA)
        .send({ text: 'hello world, english only' })
        .expect(422);
    });

    it('requires auth', async () => {
      await request(server)
        .post('/v1/tts')
        .send({ text: BENGALI_TEXT })
        .expect(401);
    });
  });

  describe('job lifecycle', () => {
    it('processes a job to completed with timestamps', async () => {
      const jobId = await submitJob(keyA);
      const done = await waitForStatus(keyA, jobId, 'completed');

      expect(done.startedAt).toBeDefined();
      expect(done.finishedAt).toBeDefined();
      expect(done.charCount).toBe(BENGALI_TEXT.length);
    });

    it('serves completed audio as a WAV stream', async () => {
      const jobId = await submitJob(keyA);
      await waitForStatus(keyA, jobId, 'completed');

      const res = await request(server)
        .get(`/v1/jobs/${jobId}/audio`)
        .set('x-api-key', keyA)
        .responseType('blob')
        .expect(200);

      expect(res.headers['content-type']).toContain('audio/wav');
      const body = res.body as Buffer;
      expect(body.subarray(0, 4).toString('ascii')).toBe('RIFF');
    });

    it('returns 409 when audio requested before completion', async () => {
      const jobId = await submitJob(keyA);
      await request(server)
        .get(`/v1/jobs/${jobId}/audio`)
        .set('x-api-key', keyA)
        .expect(409);
    });
  });

  describe('per-user isolation', () => {
    it("hides another user's job behind 404", async () => {
      const jobId = await submitJob(keyA);

      await request(server)
        .get(`/v1/jobs/${jobId}`)
        .set('x-api-key', keyB)
        .expect(404);

      await request(server)
        .get(`/v1/jobs/${jobId}/audio`)
        .set('x-api-key', keyB)
        .expect(404);
    });

    it("lists only the caller's own jobs", async () => {
      await submitJob(keyB);
      const res = await request(server)
        .get('/v1/jobs')
        .set('x-api-key', keyB)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      for (const job of res.body.data) {
        expect(job.userId).toBeUndefined();
      }
      const listA = await request(server)
        .get('/v1/jobs?limit=100')
        .set('x-api-key', keyA);
      const idsA = listA.body.data.map((j: { id: string }) => j.id);
      const idsB = res.body.data.map((j: { id: string }) => j.id);
      expect(idsA.filter((id: string) => idsB.includes(id))).toHaveLength(0);
    });
  });

  describe('robustness', () => {
    it('returns 404 for a malformed job id', async () => {
      await request(server)
        .get('/v1/jobs/not-an-objectid')
        .set('x-api-key', keyA)
        .expect(404);
    });

    it('paginates with meta', async () => {
      await submitJob(keyA);
      await submitJob(keyA);
      const res = await request(server)
        .get('/v1/jobs?page=1&limit=2')
        .set('x-api-key', keyA)
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(2);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(3);
    });
  });
});
