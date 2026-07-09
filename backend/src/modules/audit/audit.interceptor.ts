import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { AuthenticatedUser } from '../../shared/infrastructure/auth/decorators';
import { AuditService } from './audit.service';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Registra toda mutação bem-sucedida (LGPD: usuário, ação, data).
 * Nunca grava o corpo da requisição — pode conter dados sensíveis.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    if (!MUTATING_METHODS.has(request.method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        void this.auditService.log({
          userId: request.user?.id,
          action: `${request.method} ${(request.route as { path?: string } | undefined)?.path ?? request.url}`,
          entity: context.getClass().name.replace('Controller', ''),
          entityId: (request.params as Record<string, string>).id,
          ip: request.ip,
        });
      }),
    );
  }
}
