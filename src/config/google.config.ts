import { registerAs } from '@nestjs/config';

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

export const googleConfig = registerAs('google', (): GoogleConfig => ({
  clientId: process.env.GOOGLE_CLIENT_ID as string,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
  callbackUrl:
    process.env.GOOGLE_CALLBACK_URL ??
    'http://localhost:3000/api/v1/auth/google/callback',
}));
