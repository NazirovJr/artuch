import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import type { StockSource } from './entities/stock-level.entity';
import { CostingService } from './costing.service';

@Controller('stock/costing')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class CostingController {
  constructor(private costingService: CostingService) {}

  // COGS reports are revenue-adjacent — only managers/owners.
  @Get('cogs')
  @CheckPolicies((ability) => ability.can('read', 'Analytics'))
  getCOGS(
    @Query('source') source?: StockSource,
    @Query('itemId') itemId?: string,
    @Query('locationId') locationId?: string,
    @Query('from') fromDate?: string,
    @Query('to') toDate?: string,
  ) {
    return this.costingService.getCOGS({
      source,
      itemId,
      locationId,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    });
  }

  @Get('valuation')
  @CheckPolicies((ability) => ability.can('read', 'Analytics'))
  getValuation(
    @Query('source') source?: StockSource,
    @Query('locationId') locationId?: string,
  ) {
    return this.costingService.getValuation({ source, locationId });
  }
}
