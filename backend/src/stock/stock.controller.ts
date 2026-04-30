import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import type { StockSource } from './entities/stock-level.entity';
import type { StockMovementType } from './entities/stock-movement.entity';
import { StockService } from './stock.service';

@Controller('stock')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class StockController {
  constructor(private stockService: StockService) {}

  @Get('levels')
  @CheckPolicies(
    (ability) =>
      ability.can('read', 'WarehouseItem') ||
      ability.can('read', 'InventoryItem'),
  )
  findLevels(
    @Query('locationId') locationId?: string,
    @Query('itemId') itemId?: string,
    @Query('source') source?: StockSource,
  ) {
    if (itemId) {
      return this.stockService.findLevelsByItem(itemId, source);
    }
    if (locationId) {
      return this.stockService.findLevelsByLocation(locationId, source);
    }
    return [];
  }

  @Get('levels/:source/:itemId/:locationId')
  @CheckPolicies(
    (ability) =>
      ability.can('read', 'WarehouseItem') ||
      ability.can('read', 'InventoryItem'),
  )
  findOne(
    @Param('source') source: StockSource,
    @Param('itemId') itemId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.stockService.findLevel({ source, itemId, locationId });
  }

  @Get('movements')
  @CheckPolicies(
    (ability) =>
      ability.can('read', 'WarehouseTransaction') ||
      ability.can('read', 'InventoryMovement'),
  )
  findMovements(
    @Query('source') source?: StockSource,
    @Query('itemId') itemId?: string,
    @Query('locationId') locationId?: string,
    @Query('type') type?: StockMovementType,
    @Query('referenceType') referenceType?: string,
    @Query('referenceId') referenceId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.stockService.findMovements({
      source,
      itemId,
      locationId,
      type,
      referenceType,
      referenceId,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
