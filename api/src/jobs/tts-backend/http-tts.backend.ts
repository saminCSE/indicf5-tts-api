import { Logger } from '@nestjs/common';
import { TtsBackend } from './tts-backend.interface';

export class HttpTtsBackend implements TtsBackend {
  private readonly logger = new Logger(HttpTtsBackend.name);

  constructor(
    private readonly serviceUrl: string,
    private readonly timeoutMs: number,
  ) {}

  async synthesize(text: string): Promise<Buffer> {
    const response = await fetch(`${this.serviceUrl}/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.error(`Model server responded ${response.status}: ${detail}`);
      throw new Error(`TTS model server error (${response.status})`);
    }

    return Buffer.from(await response.arrayBuffer());
  }
}
