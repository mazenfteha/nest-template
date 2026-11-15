import { ConsoleLogger, LogLevel } from '@nestjs/common';

/** Most verbose first. Choosing a level enables it and everything after it. */
const ORDERED_LEVELS: LogLevel[] = ['verbose', 'debug', 'log', 'warn', 'error'];

/**
 * Active log levels from `LOG_LEVEL` (verbose | debug | log | warn | error).
 * Defaults to `debug` in development and `log` everywhere else.
 * Read from `process.env` directly because the logger is created before ConfigModule.
 */
export function logLevels(): LogLevel[] {
  const fallback: LogLevel =
    (process.env.NODE_ENV ?? 'development') === 'development' ? 'debug' : 'log';
  const requested = process.env.LOG_LEVEL as LogLevel | undefined;
  const level = ORDERED_LEVELS.includes(requested) ? requested : fallback;
  // `fatal` is always on: it is more serious than `error`.
  return [...ORDERED_LEVELS.slice(ORDERED_LEVELS.indexOf(level)), 'fatal'];
}

/**
 * The application logger. Wired once in `main.ts` via `NestFactory.create(..., { logger })`;
 * every `new Logger('Context')` in the app writes through it.
 */
export class AppLogger extends ConsoleLogger {
  constructor() {
    super();
    this.setLogLevels(logLevels());
  }
}
