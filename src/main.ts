import {
  ClassSerializerInterceptor,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import type { AppConfig } from './config/app.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Structured logging (pino) as the app logger.
  app.useLogger(app.get(Logger));

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
  app.get(Logger).log(`Application listening on port ${port} (/${apiPrefix})`);
}

bootstrap();
