import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import { Audit } from '../common/decorators/audit.decorator';
import { MaintenanceService } from './maintenance.service';

/**
 * Triggerable operational endpoints. Designed for either a cron (`curl`
 * from a host scheduler) or for an admin clicking a button in the staff
 * app. CASL gates them to manage Analytics + Warehouse — only owner /
 * admin / manager can run them.
 */
@Controller('maintenance')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class MaintenanceController {
  constructor(private maintenanceService: MaintenanceService) {}

  @Post('expire-stale-transfers')
  @CheckPolicies((ability) => ability.can('manage', 'StockTransfer'))
  @Audit('update', 'StockTransfer')
  expireStaleTransfers(@Body() body?: { days?: number }) {
    return this.maintenanceService.expireStaleTransfers(body?.days);
  }

  @Post('clean-resolved-alerts')
  @CheckPolicies((ability) => ability.can('manage', 'LowStockAlert'))
  @Audit('update', 'LowStockAlert')
  cleanResolvedAlerts(@Body() body?: { days?: number }) {
    return this.maintenanceService.cleanStaleAcknowledgedAlerts(body?.days);
  }

  @Get('expiring-digest')
  @CheckPolicies((ability) => ability.can('read', 'WarehouseItem'))
  expiringDigest(@Query('days') days?: string) {
    return this.maintenanceService.expiringDigest(
      days ? Number(days) : undefined,
    );
  }
}
