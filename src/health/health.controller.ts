import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaHealthIndicator } from './prisma.health';

@Public()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaHealthIndicator,
  ) {}

  /** Liveness — is the process alive? (cheap, no external deps). */
  @Get('live')
  @HealthCheck()
  liveness() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
    ]);
  }

  /** Readiness — can the service handle traffic? (checks the database). */
  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([() => this.prisma.isHealthy('database')]);
  }
}
