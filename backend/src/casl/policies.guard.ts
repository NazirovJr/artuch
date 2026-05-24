import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory, AppAbility } from './casl-ability.factory';
import { CHECK_POLICIES_KEY, PolicyHandler } from './check-policies.decorator';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handlers = this.reflector.getAllAndOverride<PolicyHandler[]>(
      CHECK_POLICIES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!handlers || handlers.length === 0) {
      return true; // No policies defined — allow access
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // The JWT payload exposes the user id as `sub` (jwt.strategy), but row-level
    // CASL conditions are written as `${user.id}`. Normalise so the factory
    // substitutes the real id — otherwise conditions resolve to "undefined" and
    // match nothing (which silently disabled every conditional rule).
    const ability = await this.caslAbilityFactory.createForUser({
      id: user.id || user.sub,
      role: user.role,
    });

    // Attach ability to request for use in controllers/services
    request.ability = ability;

    return handlers.every((handler) => handler(ability));
  }
}
