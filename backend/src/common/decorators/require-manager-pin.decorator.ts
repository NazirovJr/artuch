import { SetMetadata } from '@nestjs/common';

export const REQUIRE_MANAGER_PIN_KEY = 'auth:require-manager-pin';

export interface RequireManagerPinMetadata {
  reason: string;
  /**
   * Optional condition function: receives the request and returns true if
   * the PIN is required for this specific call. Used e.g. for closing a
   * folio only when balance > 0.
   */
  when?: (req: any) => boolean | Promise<boolean>;
}

/**
 * Marks a controller handler as requiring a manager PIN. The PIN is read from
 * `body.managerPin` and validated by ManagerApprovalGuard. The approving
 * userId is attached to `req.managerApproval` for the service to persist.
 */
export const RequireManagerPin = (
  reason: string,
  when?: (req: any) => boolean | Promise<boolean>,
) => SetMetadata(REQUIRE_MANAGER_PIN_KEY, { reason, when });
