import {
  ClassSerializerInterceptor,
  Logger,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import type { AppConfig } from './config/app.config';
import helmet from 'helmet';
import { AppLogger } from './common/logging/app-logger';
import { requestIdMiddleware } from './common/context/request-id.middleware';
import { requestLoggerMiddleware } from './common/logging/request-logger.middleware';

async function bootstrap(): Promise<void> {
  // The only logger setup point: every `new Logger('X')` writes through AppLogger.
  const app = await NestFactory.create(AppModule, { logger: new AppLogger() });

  // Order matters: request id first (so later logs can use it), then the per-request log line.
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);

  // Secure HTTP headers.
  app.use(helmet());

  const config = app.get(ConfigService);
  const { port, apiPrefix, corsOrigins } = config.getOrThrow<AppConfig>('app');

  // Global route prefix → /api/...
  app.setGlobalPrefix(apiPrefix);

  // URI versioning → /api/v1/...
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Validate & transform all incoming payloads.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Serialize responses (honours @Exclude/@Expose, hides passwordHash).
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // CORS
  app.enableCors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
  });

  // Graceful shutdown — fire OnApplicationShutdown hooks (Prisma disconnects).
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(
    `Application listening on port ${port} (/${apiPrefix})`,
  );
}

bootstrap();
