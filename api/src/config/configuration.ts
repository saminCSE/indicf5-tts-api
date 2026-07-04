export interface AppConfig {
  port: number;
  rateLimitPerMinute: number;
  mongoUri: string;
  redis: {
    host: string;
    port: number;
    bullPrefix: string;
  };
  tts: {
    backend: 'mock' | 'space' | 'local';
    maxChars: number;
    queueMaxDepth: number;
    jobTimeoutMs: number;
    serviceUrl: string;
    space: {
      id: string;
      refAudioUrl: string;
      refText: string;
      hfToken?: string;
    };
  };
}

export default (): AppConfig => {
  const required = ['MONGO_URI', 'REDIS_HOST', 'REDIS_PORT'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  const backend = process.env.TTS_BACKEND ?? 'mock';
  if (backend !== 'mock' && backend !== 'space' && backend !== 'local') {
    throw new Error(
      `TTS_BACKEND must be 'mock', 'space' or 'local', got '${backend}'`,
    );
  }

  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE ?? '60', 10),
    mongoUri: process.env.MONGO_URI as string,
    redis: {
      host: process.env.REDIS_HOST as string,
      port: parseInt(process.env.REDIS_PORT as string, 10),
      bullPrefix: process.env.BULL_PREFIX ?? 'bull',
    },
    tts: {
      backend,
      maxChars: parseInt(process.env.TTS_MAX_CHARS ?? '1000', 10),
      queueMaxDepth: parseInt(process.env.QUEUE_MAX_DEPTH ?? '100', 10),
      jobTimeoutMs: parseInt(process.env.JOB_TIMEOUT_MS ?? '120000', 10),
      serviceUrl: process.env.TTS_SERVICE_URL ?? 'http://localhost:8000',
      space: {
        id: process.env.HF_SPACE_ID ?? 'ai4bharat/IndicF5',
        refAudioUrl:
          process.env.REF_AUDIO_URL ??
          'https://huggingface.co/ai4bharat/IndicF5/resolve/main/prompts/PAN_F_HAPPY_00001.wav',
        refText:
          process.env.REF_TEXT ??
          'ਭਹੰਪੀ ਵਿੱਚ ਸਮਾਰਕਾਂ ਦੇ ਭਵਨ ਨਿਰਮਾਣ ਕਲਾ ਦੇ ਵੇਰਵੇ ਗੁੰਝਲਦਾਰ ਅਤੇ ਹੈਰਾਨ ਕਰਨ ਵਾਲੇ ਹਨ, ਜੋ ਮੈਨੂੰ ਖੁਸ਼ ਕਰਦੇ ਹਨ।',
        hfToken: process.env.HF_TOKEN,
      },
    },
  };
};
