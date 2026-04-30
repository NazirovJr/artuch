import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import type { StockSource } from './entities/stock-level.entity';
import { UnitConversionsService } from './unit-conversions.service';

class UpsertConversionDto {
  @IsString()
  source: StockSource;

  @IsUUID()
  itemId: string;

  @IsString()
  fromUnit: string;

  @IsNumber()
  @Min(0.0001)
  factor: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

@Controller('stock/unit-conversions')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class UnitConversionsController {
  constructor(private service: UnitConversionsService) {}

  @Get()
  @CheckPolicies(
    (ability) =>
      ability.can('read', 'WarehouseItem') ||
      ability.can('read', 'InventoryItem'),
  )
  findForItem(
    @Query('source') source: StockSource,
    @Query('itemId') itemId: string,
  ) {
    return this.service.findForItem(source, itemId);
  }

  @Post()
  @CheckPolicies(
    (ability) =>
      ability.can('manage', 'WarehouseItem') ||
      ability.can('manage', 'InventoryItem'),
  )
  upsert(@Body() body: UpsertConversionDto) {
    return this.service.upsert(body);
  }

  @Delete(':id')
  @CheckPolicies(
    (ability) =>
      ability.can('manage', 'WarehouseItem') ||
      ability.can('manage', 'InventoryItem'),
  )
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
