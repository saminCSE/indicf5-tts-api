export interface AppConfig {
  port: number;
  mongoUri: string;
  redis: {
    host: string;
    port: number;
  };
}

export default (): AppConfig => {
  const required = ['MONGO_URI', 'REDIS_HOST', 'REDIS_PORT'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    mongoUri: process.env.MONGO_URI as string,
    redis: {
      host: process.env.REDIS_HOST as string,
      port: parseInt(process.env.REDIS_PORT as string, 10),
    },
  };
};
