import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Accept caller-supplied ids only if they look like a sane token (no log injection). */
const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Correlation id for this request; also sent back as `x-request-id`. */
      id?: string;
    }
  }
}

/**
 * Reuses a valid incoming `x-request-id`, otherwise generates a UUID.
 * Stores it on `req.id` and echoes it in the response header.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const id =
    incoming && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  req.id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
