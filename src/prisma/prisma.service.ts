import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { logLevels } from '../common/logging/app-logger';

type PrismaEventHandler = (
  event: 'warn' | 'query',
  cb: (e: Prisma.LogEvent | Prisma.QueryEvent) => void,
) => void;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger('Prisma');

  constructor(config: ConfigService) {
    // SQL queries are only subscribed to when LOG_LEVEL=verbose.
    const logQueries = logLevels().includes('verbose');
    super({
      datasources: {
        db: {
          url: config.get<string>('database.url'),
        },
      },
      log: [
        { emit: 'event', level: 'warn' },
        ...(logQueries
          ? [{ emit: 'event' as const, level: 'query' as const }]
          : []),
      ],
      errorFormat: 'pretty',
    });

    const on = this.$on.bind(this) as PrismaEventHandler;
    on('warn', (e: Prisma.LogEvent) => this.logger.warn(e.message));
    if (logQueries) {
      on('query', (e: Prisma.QueryEvent) =>
        this.logger.verbose(`${e.query} (${e.duration}ms)`),
      );
    }
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
