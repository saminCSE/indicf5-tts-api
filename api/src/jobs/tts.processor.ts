import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job as BullJob } from 'bullmq';
import { MongodbService } from '../database/mongodb/mongodb.service';
import { JobStatus } from '../database/mongodb/schemas/job.schema';
import {
  AUDIO_STORAGE,
  AudioStorage,
} from './storage/audio-storage.interface';
import { TTS_BACKEND, TtsBackend } from './tts-backend/tts-backend.interface';

interface TtsJobPayload {
  jobId: string;
}

@Processor('tts', { concurrency: 1 })
export class TtsProcessor extends WorkerHost {
  private readonly logger = new Logger(TtsProcessor.name);
  private readonly timeoutMs: number;

  constructor(
    private readonly db: MongodbService,
    @Inject(TTS_BACKEND) private readonly ttsBackend: TtsBackend,
    @Inject(AUDIO_STORAGE) private readonly audioStorage: AudioStorage,
    config: ConfigService,
  ) {
    super();
    this.timeoutMs = config.get<number>('tts.jobTimeoutMs') ?? 120000;
  }

  async process(bullJob: BullJob<TtsJobPayload>): Promise<void> {
    const { jobId } = bullJob.data;
    const job = await this.db.jobs.findById(jobId);
    if (!job) {
      this.logger.warn(`Job ${jobId} not found in database, skipping`);
      return;
    }

    job.status = JobStatus.PROCESSING;
    job.startedAt = new Date();
    await job.save();

    try {
      const audio = await this.withTimeout(
        this.ttsBackend.synthesize(job.inputText),
      );
      const fileId = await this.audioStorage.save(audio, `${jobId}.wav`);

      job.status = JobStatus.COMPLETED;
      job.audioFileId = fileId;
      job.finishedAt = new Date();
      await job.save();
      this.logger.log(`Job ${jobId} completed`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const isFinalAttempt =
        bullJob.attemptsMade + 1 >= (bullJob.opts.attempts ?? 1);

      if (isFinalAttempt) {
        job.status = JobStatus.FAILED;
        job.error = message;
        job.finishedAt = new Date();
        await job.save();
        this.logger.error(`Job ${jobId} failed permanently: ${message}`);
      } else {
        this.logger.warn(`Job ${jobId} attempt failed, will retry: ${message}`);
      }
      throw err;
    }
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`TTS timed out after ${this.timeoutMs}ms`)),
        this.timeoutMs,
      );
      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((err: unknown) => {
          clearTimeout(timer);
          reject(err instanceof Error ? err : new Error(String(err)));
        });
    });
  }
}
