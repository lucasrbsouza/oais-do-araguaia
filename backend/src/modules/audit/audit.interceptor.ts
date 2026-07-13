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
 * Mapa rota → ação semântica. Rotas de auth ficam de fora: login/logout
 * são registrados explicitamente nos use cases (com o usuário correto).
 */
const ACTION_MAP: Record<string, { action: string; entity: string }> = {
  'POST /api/users': { action: 'USER_CREATED', entity: 'User' },
  'PATCH /api/users/:id': { action: 'USER_UPDATED', entity: 'User' },
  'DELETE /api/users/:id': { action: 'USER_DELETED', entity: 'User' },
  'PATCH /api/users/me': { action: 'PROFILE_UPDATED', entity: 'User' },
  'POST /api/users/me/password': { action: 'PASSWORD_CHANGED', entity: 'User' },
  'POST /api/users/me/avatar': { action: 'AVATAR_UPDATED', entity: 'User' },

  'POST /api/chalets': { action: 'CHALET_CREATED', entity: 'Chalet' },
  'PATCH /api/chalets/:id': { action: 'CHALET_UPDATED', entity: 'Chalet' },
  'DELETE /api/chalets/:id': { action: 'CHALET_DELETED', entity: 'Chalet' },

  'POST /api/events': { action: 'EVENT_CREATED', entity: 'Event' },
  'PATCH /api/events/:id': { action: 'EVENT_UPDATED', entity: 'Event' },
  'POST /api/events/:id/cancel': { action: 'EVENT_CANCELLED', entity: 'Event' },
  'POST /api/events/:id/close': { action: 'EVENT_CLOSED', entity: 'Event' },
  'POST /api/events/:id/reopen': { action: 'EVENT_REOPENED', entity: 'Event' },
  'DELETE /api/events/:id': { action: 'EVENT_DELETED', entity: 'Event' },

  'POST /api/reservations': {
    action: 'RESERVATION_CREATED',
    entity: 'Reservation',
  },
  'PATCH /api/reservations/:id': {
    action: 'RESERVATION_UPDATED',
    entity: 'Reservation',
  },
  'POST /api/reservations/:id/cancel': {
    action: 'RESERVATION_CANCELLED',
    entity: 'Reservation',
  },
  'DELETE /api/reservations/:id': {
    action: 'RESERVATION_DELETED',
    entity: 'Reservation',
  },

  'POST /api/purchases': { action: 'PURCHASE_CREATED', entity: 'Purchase' },
  'PATCH /api/purchases/:id': {
    action: 'PURCHASE_UPDATED',
    entity: 'Purchase',
  },
  'DELETE /api/purchases/:id': {
    action: 'PURCHASE_DELETED',
    entity: 'Purchase',
  },
  'POST /api/purchases/:id/receipt': {
    action: 'PURCHASE_RECEIPT_ATTACHED',
    entity: 'Purchase',
  },

  'POST /api/events/:eventId/settlement/calculate': {
    action: 'SETTLEMENT_CALCULATED',
    entity: 'Settlement',
  },
  'PUT /api/events/:eventId/settlement/auto': {
    action: 'SETTLEMENT_AUTO_CONFIGURED',
    entity: 'Settlement',
  },

  'POST /api/payments': { action: 'PAYMENT_REGISTERED', entity: 'Payment' },
  'PATCH /api/receivables/:id/settle': {
    action: 'RECEIVABLE_SETTLED',
    entity: 'Receivable',
  },
};

/** Dados extras só desta ação, tirados da requisição/resposta. */
function extraMetadata(
  action: string,
  request: Request & { file?: { originalname?: string } },
  response: unknown,
): Record<string, unknown> {
  const body = (response ?? {}) as Record<string, unknown>;
  switch (action) {
    case 'SETTLEMENT_AUTO_CONFIGURED':
      return { mode: body.mode, intervalMinutes: body.intervalMinutes ?? null };
    case 'PURCHASE_RECEIPT_ATTACHED':
    case 'AVATAR_UPDATED':
      return { fileName: request.file?.originalname ?? null };
    default:
      return {};
  }
}

/**
 * Registra toda mutação bem-sucedida (LGPD: usuário, ação, data) junto de um
 * resumo legível do registro afetado. Nunca grava o corpo da requisição — pode
 * conter dados sensíveis; o resumo vem de campos escolhidos a dedo no banco.
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

    const routePath =
      (request.route as { path?: string } | undefined)?.path ?? request.url;
    if (routePath.startsWith('/api/auth')) {
      return next.handle();
    }

    const params = request.params as Record<string, string>;
    const mapped = ACTION_MAP[`${request.method} ${routePath}`];
    const action = mapped?.action ?? `${request.method} ${routePath}`;
    const entity =
      mapped?.entity ?? context.getClass().name.replace('Controller', '');
    // Rotas "me" não têm id na URL: o alvo é o próprio usuário logado.
    const paramId = routePath.startsWith('/api/users/me')
      ? request.user?.id
      : (params.id ?? params.eventId ?? params.chaletId);

    // Em exclusões o registro some depois do handler: fotografa antes.
    const deletedSnapshot =
      request.method === 'DELETE' && paramId
        ? this.auditService
            .describeEntity(entity, paramId)
            .catch(() => undefined)
        : undefined;

    return next.handle().pipe(
      tap((response) => {
        void this.record(
          request,
          action,
          entity,
          paramId,
          response,
          deletedSnapshot,
        );
      }),
    );
  }

  private async record(
    request: Request & { user?: AuthenticatedUser },
    action: string,
    entity: string,
    paramId: string | undefined,
    response: unknown,
    deletedSnapshot: Promise<Record<string, unknown> | undefined> | undefined,
  ): Promise<void> {
    // Criações não têm id na rota: ele só existe na resposta.
    const responseId = (response as { id?: string } | undefined)?.id;
    const entityId = paramId ?? responseId;

    let snapshot: Record<string, unknown> | undefined;
    try {
      snapshot = deletedSnapshot
        ? await deletedSnapshot
        : entityId
          ? await this.auditService.describeEntity(entity, entityId)
          : undefined;
    } catch {
      snapshot = undefined;
    }

    const metadata = {
      ...snapshot,
      ...extraMetadata(action, request, response),
    };

    await this.auditService.log({
      userId: request.user?.id,
      action,
      entity,
      entityId,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      ip: request.ip,
    });
  }
}
