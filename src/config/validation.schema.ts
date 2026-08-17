import * as Joi from 'joi';

/**
 * Validated at startup by ConfigModule. The app fails fast (won't boot) if any
 * required variable is missing or malformed — no silent misconfiguration.
 */
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api'),
  CORS_ORIGINS: Joi.string().default('*'),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: Joi.number().min(1).default(7),

  // Google OAuth2 — credentials from the Google Cloud Console
  GOOGLE_CLIENT_ID: Joi.string().required(),
  GOOGLE_CLIENT_SECRET: Joi.string().required(),
  GOOGLE_CALLBACK_URL: Joi.string()
    .uri()
    .default('http://localhost:3000/api/v1/auth/google/callback'),

  // Optional seed overrides (used by prisma/seed.ts)
  SEED_ADMIN_EMAIL: Joi.string().email().optional(),
  SEED_ADMIN_PASSWORD: Joi.string().optional(),
});
