import { registerAs } from '@nestjs/config';

export type Environment = 'development' | 'staging' | 'production' | 'test';

export interface AppConfig {
  environment: Environment;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
}

export const appConfig = registerAs('app', (): AppConfig => ({
  environment: (process.env.NODE_ENV as Environment) ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  corsOrigins: (process.env.CORS_ORIGINS ?? '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
}));
