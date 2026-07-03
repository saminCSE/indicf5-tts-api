export interface AppConfig {
  port: number;
  mongoUri: string;
  redis: {
    host: string;
    port: number;
    bullPrefix: string;
  };
  tts: {
    backend: 'mock' | 'real';
    maxChars: number;
    queueMaxDepth: number;
    jobTimeoutMs: number;
    serviceUrl: string;
  };
}

export default (): AppConfig => {
  const required = ['MONGO_URI', 'REDIS_HOST', 'REDIS_PORT'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  const backend = process.env.TTS_BACKEND ?? 'mock';
  if (backend !== 'mock' && backend !== 'real') {
    throw new Error(`TTS_BACKEND must be 'mock' or 'real', got '${backend}'`);
  }

  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
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
    },
  };
};
