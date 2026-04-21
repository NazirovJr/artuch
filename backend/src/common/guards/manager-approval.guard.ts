import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ManagerApprovalService } from '../../auth/manager-approval.service';
import {
  REQUIRE_MANAGER_PIN_KEY,
  RequireManagerPinMetadata,
} from '../decorators/require-manager-pin.decorator';

/**
 * Reads `@RequireManagerPin('reason', when?)` metadata. If applicable to the
 * current request (no `when` predicate or it returns true), validates the
 * `managerPin` field from the request body via ManagerApprovalService and
 * attaches `req.managerApproval = { userId, reason, approvedAt }` for the
 * downstream handler to persist.
 */
@Injectable()
export class ManagerApprovalGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly approvalService: ManagerApprovalService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.get<RequireManagerPinMetadata>(
      REQUIRE_MANAGER_PIN_KEY,
      context.getHandler(),
    );
    if (!meta) return true;

    const req = context.switchToHttp().getRequest();
    if (meta.when) {
      const required = await meta.when(req);
      if (!required) return true;
    }

    const pin = req.body?.managerPin;
    const userId = await this.approvalService.validatePin(pin);
    req.managerApproval = {
      userId,
      reason: meta.reason,
      approvedAt: new Date(),
    };
    // Strip pin from body so it doesn't leak into audit logs (audit interceptor
    // also masks `managerPin`, but defense-in-depth).
    if (req.body) delete req.body.managerPin;
    return true;
  }
}
