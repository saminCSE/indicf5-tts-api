import { Logger } from '@nestjs/common';
import { TtsBackend } from './tts-backend.interface';

type GradioClient = {
  predict: (
    endpoint: string,
    payload: Record<string, unknown>,
  ) => Promise<{ data: unknown[] }>;
};

export interface HfSpaceOptions {
  spaceId: string;
  refAudioUrl: string;
  refText: string;
  hfToken?: string;
}

export class HfSpaceTtsBackend implements TtsBackend {
  private readonly logger = new Logger(HfSpaceTtsBackend.name);
  private client: GradioClient | null = null;
  private refAudio: Blob | null = null;

  constructor(private readonly options: HfSpaceOptions) {}

  private async connect(): Promise<GradioClient> {
    if (this.client) return this.client;

    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- @gradio/client is ESM-only; TS compiles this CJS project's import() to require(), which cannot load ESM. Function constructor preserves a real dynamic import.
    const importEsm = new Function('m', 'return import(m)') as (
      m: string,
    ) => Promise<{
      Client: {
        connect: (
          id: string,
          opts?: Record<string, unknown>,
        ) => Promise<GradioClient>;
      };
    }>;
    const { Client } = await importEsm('@gradio/client');

    this.logger.log(`Connecting to HF Space ${this.options.spaceId}...`);
    this.client = await Client.connect(
      this.options.spaceId,
      this.options.hfToken ? { hf_token: this.options.hfToken } : undefined,
    );
    return this.client;
  }

  private async getRefAudio(): Promise<Blob> {
    if (this.refAudio) return this.refAudio;
    const res = await fetch(this.options.refAudioUrl, {
      headers: this.options.hfToken
        ? { Authorization: `Bearer ${this.options.hfToken}` }
        : undefined,
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch reference audio (${res.status})`);
    }
    this.refAudio = new Blob([await res.arrayBuffer()], { type: 'audio/wav' });
    return this.refAudio;
  }

  async synthesize(text: string): Promise<Buffer> {
    const [client, refAudio] = await Promise.all([
      this.connect(),
      this.getRefAudio(),
    ]);

    const result = await client.predict('/synthesize_speech', {
      text,
      ref_audio: refAudio,
      ref_text: this.options.refText,
    });

    const output = result.data[0] as { url?: string } | null;
    if (!output?.url) {
      throw new Error('HF Space returned no audio');
    }

    const audioRes = await fetch(output.url);
    if (!audioRes.ok) {
      throw new Error(`Failed to download Space audio (${audioRes.status})`);
    }
    return Buffer.from(await audioRes.arrayBuffer());
  }
}
