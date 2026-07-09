import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../domain/domain-error';

const DOMAIN_ERROR_STATUS = new Map<
  abstract new (...args: never[]) => DomainError,
  HttpStatus
>([
  [ValidationError, HttpStatus.UNPROCESSABLE_ENTITY],
  [NotFoundError, HttpStatus.NOT_FOUND],
  [ConflictError, HttpStatus.CONFLICT],
  [ForbiddenError, HttpStatus.FORBIDDEN],
  [UnauthorizedError, HttpStatus.UNAUTHORIZED],
]);

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, body } = this.mapException(exception);

    if (status >= 500) {
      this.logger.error(
        { path: request.url, method: request.method, err: exception },
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      ...body,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private mapException(exception: unknown): {
    status: number;
    body: Record<string, unknown>;
  } {
    if (exception instanceof DomainError) {
      const status =
        DOMAIN_ERROR_STATUS.get(
          exception.constructor as abstract new (
            ...args: never[]
          ) => DomainError,
        ) ?? HttpStatus.BAD_REQUEST;
      return {
        status,
        body: {
          statusCode: status,
          code: exception.code,
          message: exception.message,
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const body =
        typeof payload === 'string'
          ? { statusCode: status, message: payload }
          : { statusCode: status, ...(payload as Record<string, unknown>) };
      return { status, body };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor.',
      },
    };
  }
}
