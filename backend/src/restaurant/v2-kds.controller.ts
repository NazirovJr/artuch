import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ChecksService } from './checks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { Audit } from '../common/decorators/audit.decorator';

/**
 * Kitchen / bar display endpoints. The `station` query param selects the queue
 * ('kitchen' | 'bar'); cooks and barmen both hold read/update Order, the UI
 * scopes each role to its own station.
 */
@Controller('v2/kds')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class V2KdsController {
  constructor(private readonly checksService: ChecksService) {}

  // KDS is a polling endpoint — exempt from rate limiting so that
  // continuous screen refreshes don't trigger 429s.
  @Get()
  @SkipThrottle()
  @CheckPolicies((ability) => ability.can('read', 'Order'))
  queue(@Query('station') station?: string) {
    return this.checksService.findStationQueue(station || 'kitchen');
  }

  @Patch('items/:itemId/status')
  @CheckPolicies((ability) => ability.can('update', 'Order'))
  @Audit('kds-status', 'Order', 'orderId')
  setStatus(
    @Param('itemId') itemId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.checksService.updateItemStatus(
      itemId,
      body.status,
      { userId: req.user.id || req.user.sub, userName: req.user.username },
      req.ability,
    );
  }
}
