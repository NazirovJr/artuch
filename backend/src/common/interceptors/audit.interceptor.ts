import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../../audit/audit.service';
import {
  AUDIT_METADATA_KEY,
  AuditMetadata,
} from '../decorators/audit.decorator';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'pin',
  'pinHash',
  'managerPin',
  'token',
  'refreshToken',
  'accessToken',
]);

function sanitize(value: any): any {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(k)) {
        out[k] = '***';
      } else {
        out[k] = sanitize(v);
      }
    }
    return out;
  }
  return value;
}

function getByPath(obj: any, path: string): string | undefined {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  if (cur == null) return undefined;
  return String(cur);
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const meta = this.reflector.get<AuditMetadata>(
      AUDIT_METADATA_KEY,
      context.getHandler(),
    );
    if (!meta) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const userId = user?.sub || user?.id || 'anonymous';
    const userName = user?.username || 'anonymous';
    const ipAddress =
      (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      undefined;

    const requestBody = sanitize(req.body || {});
    const params = req.params || {};
    const query = req.query || {};

    return next.handle().pipe(
      tap((response) => {
        let subjectId: string | undefined;
        if (meta.subjectIdPath && meta.subjectIdPath !== 'null') {
          subjectId =
            getByPath(response, meta.subjectIdPath) ||
            getByPath(params, meta.subjectIdPath) ||
            getByPath(params, 'id') ||
            getByPath(params, 'number');
        }

        const changes: Record<string, any> = {};
        if (Object.keys(requestBody).length) changes.body = requestBody;
        if (Object.keys(params).length) changes.params = params;
        if (Object.keys(query).length) changes.query = query;

        this.auditService
          .log({
            userId,
            userName,
            action: meta.action,
            subject: meta.subject,
            subjectId,
            changes: Object.keys(changes).length ? changes : undefined,
            ipAddress,
          })
          .catch((err) => {
            this.logger.error(
              `Failed to write audit log for ${meta.action}/${meta.subject}: ${err?.message || err}`,
            );
          });
      }),
    );
  }
}
