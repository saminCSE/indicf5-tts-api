import { Injectable } from '@nestjs/common';
import { TtsBackend } from './tts-backend.interface';

const SAMPLE_RATE = 24000;
const DURATION_SECONDS = 1;
const MOCK_DELAY_MS = 300;

@Injectable()
export class MockTtsBackend implements TtsBackend {
  async synthesize(_text: string): Promise<Buffer> {
    await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
    return this.buildSilenceWav();
  }

  private buildSilenceWav(): Buffer {
    const dataSize = SAMPLE_RATE * DURATION_SECONDS * 2;
    const header = Buffer.alloc(44);

    header.write('RIFF', 0, 'ascii');
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8, 'ascii');
    header.write('fmt ', 12, 'ascii');
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(SAMPLE_RATE, 24);
    header.writeUInt32LE(SAMPLE_RATE * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36, 'ascii');
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, Buffer.alloc(dataSize)]);
  }
}
