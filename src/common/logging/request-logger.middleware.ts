import { Logger } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

/**
 * Writes one `[HTTP] METHOD URL STATUS TIMEms` line per request when the response finishes.
 * 2xx/3xx → log, 4xx → warn, 5xx → error. Health probes are skipped.
 * Headers and bodies are never logged.
 */
export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const url = req.originalUrl;
  if (url.includes('/health/')) return next();

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number((process.hrtime.bigint() - start) / BigInt(1_000_000));
    const line = `${req.method} ${url} ${res.statusCode} ${ms}ms`;
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.log(line);
  });
  next();
}
