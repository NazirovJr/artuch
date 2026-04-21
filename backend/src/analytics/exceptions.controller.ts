import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ExceptionsService } from './exceptions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';

/**
 * Exception/owner-feed endpoints for the loss-prevention dashboards. All
 * routes require Analytics:read; the staff app exposes them only to
 * admin/manager/owner roles.
 */
@Controller('v2/analytics')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class ExceptionsController {
  constructor(private readonly exceptionsService: ExceptionsService) {}

  @Get('exceptions')
  @CheckPolicies((ability) => ability.can('read', 'Analytics'))
  getExceptions(@Query('from') from?: string, @Query('to') to?: string) {
    return this.exceptionsService.getSummary({ from, to });
  }

  @Get('exceptions/refunds')
  @CheckPolicies((ability) => ability.can('read', 'Analytics'))
  getRefundsByEmployee(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.exceptionsService.refundsByEmployee({ from, to });
  }

  @Get('exceptions/discounts')
  @CheckPolicies((ability) => ability.can('read', 'Analytics'))
  getDiscountsByEmployee(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.exceptionsService.discountsByEmployee({ from, to });
  }

  @Get('exceptions/shifts')
  @CheckPolicies((ability) => ability.can('read', 'Analytics'))
  getShiftsWithVariance(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.exceptionsService.shiftsWithVariance({ from, to });
  }

  @Get('owner-feed')
  @CheckPolicies((ability) => ability.can('read', 'Analytics'))
  getOwnerFeed(@Query('limit') limit?: string) {
    return this.exceptionsService.getOwnerFeed(
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
