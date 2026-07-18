import { registerAs } from '@nestjs/config';

export interface JwtConfig {
  accessSecret: string;
  accessExpiresIn: string;
  refreshExpiresDays: number;
}

export const jwtConfig = registerAs('jwt', (): JwtConfig => ({
  accessSecret: process.env.JWT_ACCESS_SECRET as string,
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  refreshExpiresDays: parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS ?? '7', 10),
}));
