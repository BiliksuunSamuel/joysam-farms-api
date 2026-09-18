import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'auditLog';

export type AuditLogMeta = { entityType: string; action: string };

/**
 * Tags a controller method for the AuditLogInterceptor: on a successful
 * (2xx) response, it records `action` against `entityType` automatically -
 * no change to the method body needed. Requires the controller (or method)
 * to also have `@UseInterceptors(AuditLogInterceptor)`.
 */
export const AuditLog = (entityType: string, action: string) =>
  SetMetadata(AUDIT_LOG_KEY, { entityType, action } as AuditLogMeta);
