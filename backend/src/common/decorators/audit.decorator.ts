import { SetMetadata } from '@nestjs/common';

export const AUDIT_METADATA_KEY = 'audit:meta';

export interface AuditMetadata {
  action: string;
  subject: string;
  /**
   * Path inside response body (dot-notation) for the entity id. Default: 'id'.
   * Use 'null' to omit subjectId.
   */
  subjectIdPath?: string;
}

/**
 * Mark a controller handler as auditable. After a successful response the
 * AuditInterceptor will write an entry to the audit_log table with userId,
 * userName, ipAddress, request body diff, and the resulting subjectId.
 */
export const Audit = (action: string, subject: string, subjectIdPath = 'id') =>
  SetMetadata(AUDIT_METADATA_KEY, { action, subject, subjectIdPath });
