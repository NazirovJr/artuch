import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import type { StockSource } from './entities/stock-level.entity';
import { LotsService } from './lots.service';

@Controller('stock/lots')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class LotsController {
  constructor(private lotsService: LotsService) {}

  @Get()
  @CheckPolicies(
    (ability) =>
      ability.can('read', 'WarehouseItem') ||
      ability.can('read', 'InventoryItem'),
  )
  findActive(
    @Query('source') source?: StockSource,
    @Query('itemId') itemId?: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.lotsService.findActiveLots({ source, itemId, locationId });
  }

  @Get('expiring')
  @CheckPolicies(
    (ability) =>
      ability.can('read', 'WarehouseItem') ||
      ability.can('read', 'InventoryItem'),
  )
  findExpiring(
    @Query('days') days?: string,
    @Query('includeExpired') includeExpired?: string,
  ) {
    const daysAhead = days ? Number(days) : 14;
    return this.lotsService.findExpiringSoon(
      daysAhead,
      includeExpired === 'true',
    );
  }
}
