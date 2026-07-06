import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Types } from 'mongoose';
import { Readable } from 'stream';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { MongodbService } from '../database/mongodb/mongodb.service';
import { JobDocument, JobStatus } from '../database/mongodb/schemas/job.schema';
import { CreateTtsDto } from './dto/create-tts.dto';
import type { AudioStorage } from './storage/audio-storage.interface';
import { AUDIO_STORAGE } from './storage/audio-storage.interface';

const BENGALI_CHAR_REGEX = /[ঀ-৿]/;

export interface JobView {
  id: string;
  status: JobStatus;
  charCount: number;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

@Injectable()
export class JobsService {
  private readonly queueMaxDepth: number;

  constructor(
    private readonly db: MongodbService,
    @InjectQueue('tts') private readonly ttsQueue: Queue,
    @Inject(AUDIO_STORAGE) private readonly audioStorage: AudioStorage,
    config: ConfigService,
  ) {
    this.queueMaxDepth = config.get<number>('tts.queueMaxDepth') ?? 100;
  }

  private toView(job: JobDocument): JobView {
    return {
      id: job._id.toString(),
      status: job.status,
      charCount: job.charCount,
      error: job.error,
      createdAt: job.get('createdAt') as Date,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    };
  }

  async submit(user: AuthenticatedUser, dto: CreateTtsDto) {
    if (!BENGALI_CHAR_REGEX.test(dto.text)) {
      throw new UnprocessableEntityException(
        'Text must contain Bengali characters',
      );
    }

    const waiting = await this.ttsQueue.getWaitingCount();
    if (waiting >= this.queueMaxDepth) {
      throw new ServiceUnavailableException(
        'Queue is full, please retry shortly',
      );
    }

    const job = await this.db.jobs.create({
      userId: new Types.ObjectId(user.userId),
      inputText: dto.text,
      charCount: dto.text.length,
    });

    await this.ttsQueue.add('synthesize', { jobId: job._id.toString() });

    return { jobId: job._id.toString(), status: job.status };
  }

  async findAllForUser(user: AuthenticatedUser, page = 1, limit = 10) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const filter = { userId: new Types.ObjectId(user.userId) };

    const [jobs, total] = await Promise.all([
      this.db.jobs
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit),
      this.db.jobs.countDocuments(filter),
    ]);

    return {
      items: jobs.map((job) => this.toView(job)),
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  private async findOwnedJob(
    user: AuthenticatedUser,
    id: string,
  ): Promise<JobDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Job not found');
    }
    const job = await this.db.jobs.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(user.userId),
    });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    return job;
  }

  async findOneForUser(user: AuthenticatedUser, id: string): Promise<JobView> {
    return this.toView(await this.findOwnedJob(user, id));
  }

  async getAudioStream(
    user: AuthenticatedUser,
    id: string,
  ): Promise<{ stream: Readable; filename: string }> {
    const job = await this.findOwnedJob(user, id);

    if (job.status !== JobStatus.COMPLETED || !job.audioFileId) {
      throw new ConflictException(
        `Audio not ready — job status is '${job.status}'`,
      );
    }

    return {
      stream: this.audioStorage.stream(job.audioFileId),
      filename: `${job._id.toString()}.wav`,
    };
  }
}
