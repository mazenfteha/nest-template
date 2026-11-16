import { registerAs } from '@nestjs/config';

export type Environment = 'development' | 'staging' | 'production' | 'test';

export interface AppConfig {
  environment: Environment;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  /** Liveness fails when V8 heap use exceeds this (MB). */
  healthHeapLimitMb: number;
}

export const appConfig = registerAs('app', (): AppConfig => ({
  environment: (process.env.NODE_ENV as Environment) ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  corsOrigins: (process.env.CORS_ORIGINS ?? '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  healthHeapLimitMb: parseInt(process.env.HEALTH_HEAP_LIMIT_MB ?? '300', 10),
}));
