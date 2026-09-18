import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  AUDIT_LOG_KEY,
  AuditLogMeta,
} from 'src/decorators/audit-log.decorator';
import { AuditLogService } from 'src/services/audit-log.service';

/**
 * Every controller in this app sends its response manually via
 * `@Res() response.status(...).send(...)` rather than returning a value for
 * Nest to serialise - so `next.handle()`'s emitted value is always
 * `undefined` here, and we can't read the response that way. Instead we
 * temporarily wrap `response.json` to capture the body as it goes out, then
 * log from that capture once the handler has finished.
 *
 * This wraps `.json`, not `.send`: every controller here sends a plain
 * object, and Express's real `res.send(obj)` always delegates to
 * `res.json(obj)` for a non-Buffer object body - wrapping `.send` instead
 * double-captures, because `res.json()` itself calls `this.send(body)` with
 * the already-stringified body, overwriting the real (object) capture with
 * a JSON string that has no `.code` property.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const meta = this.reflector.get<AuditLogMeta>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );
    if (!meta) return next.handle();

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    let captured: any;
    const originalJson = response.json.bind(response);
    response.json = (body: any) => {
      captured = body;
      return originalJson(body);
    };

    return next.handle().pipe(
      tap(() => {
        const success = captured?.code >= 200 && captured?.code < 300;
        if (!success) return;

        const entityId =
          captured?.data?.id ??
          captured?.data?.user?.id ??
          request.params?.id ??
          undefined;
        const performedById = request.user?.id;

        void this.auditLogService.record({
          entityType: meta.entityType,
          entityId,
          action: meta.action,
          description: `${meta.action} ${meta.entityType}${entityId ? ` (${entityId})` : ''}`,
          performedById,
          ipAddress: request.ip,
          agent: request.headers['user-agent'],
        });
      }),
    );
  }
}
