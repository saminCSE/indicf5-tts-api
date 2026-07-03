import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { AUDIO_STORAGE } from './storage/audio-storage.interface';
import { GridFsAudioStorage } from './storage/gridfs-audio.storage';
import { MockTtsBackend } from './tts-backend/mock-tts.backend';
import { TTS_BACKEND } from './tts-backend/tts-backend.interface';
import { TtsProcessor } from './tts.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'tts',
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    }),
  ],
  controllers: [JobsController],
  providers: [
    JobsService,
    TtsProcessor,
    { provide: TTS_BACKEND, useClass: MockTtsBackend },
    { provide: AUDIO_STORAGE, useClass: GridFsAudioStorage },
  ],
})
export class JobsModule {}
