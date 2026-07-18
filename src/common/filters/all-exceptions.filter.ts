import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger } from 'nestjs-pino';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
}

/**
 * Catches every unhandled exception and returns a consistent JSON shape.
 * 5xx are logged as errors (with stack); 4xx as warnings.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const { message, error } = this.normalize(exception, status);

    const body: ErrorBody = {
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    const context = `${request.method} ${request.url}`;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        { err: exception, statusCode: status },
        `Unhandled exception: ${context}`,
      );
    } else {
      this.logger.warn({ statusCode: status }, `Request error: ${context}`);
    }

    response.status(status).json(body);
  }

  private normalize(
    exception: unknown,
    status: number,
  ): { message: string | string[]; error: string } {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return { message: res, error: exception.name };
      }
      const obj = res as Record<string, unknown>;
      return {
        message: (obj.message as string | string[]) ?? exception.message,
        error: (obj.error as string) ?? exception.name,
      };
    }
    return {
      message:
        status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Internal server error'
          : String(exception),
      error: 'InternalServerError',
    };
  }
}
