import { BullModule } from '@nestjs/bullmq';
import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { AUDIO_STORAGE } from './storage/audio-storage.interface';
import { GridFsAudioStorage } from './storage/gridfs-audio.storage';
import { HfSpaceTtsBackend } from './tts-backend/hf-space-tts.backend';
import { HttpTtsBackend } from './tts-backend/http-tts.backend';
import { MockTtsBackend } from './tts-backend/mock-tts.backend';
import type { TtsBackend } from './tts-backend/tts-backend.interface';
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
    {
      provide: TTS_BACKEND,
      inject: [ConfigService],
      useFactory: (config: ConfigService): TtsBackend => {
        const backend = config.get<'mock' | 'space' | 'local'>('tts.backend');
        new Logger('TtsBackend').log(`Using '${backend}' TTS backend`);
        switch (backend) {
          case 'space':
            return new HfSpaceTtsBackend({
              spaceId: config.get<string>('tts.space.id')!,
              refAudioUrl: config.get<string>('tts.space.refAudioUrl')!,
              refText: config.get<string>('tts.space.refText')!,
              hfToken: config.get<string>('tts.space.hfToken'),
            });
          case 'local':
            return new HttpTtsBackend(
              config.get<string>('tts.serviceUrl')!,
              config.get<number>('tts.jobTimeoutMs')!,
            );
          default:
            return new MockTtsBackend();
        }
      },
    },
    { provide: AUDIO_STORAGE, useClass: GridFsAudioStorage },
  ],
})
export class JobsModule {}
