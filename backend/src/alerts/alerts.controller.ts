import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import { CaslModule } from '../casl/casl.module';
import { AlertsService } from './alerts.service';

@Controller('alerts/low-stock')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class AlertsController {
  constructor(private alertsService: AlertsService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'LowStockAlert'))
  findAll(@Query('includeAcknowledged') includeAcknowledged?: string) {
    return this.alertsService.findAll(includeAcknowledged === 'true');
  }

  @Patch(':id/acknowledge')
  @CheckPolicies((ability) => ability.can('update', 'LowStockAlert'))
  acknowledge(
    @Param('id') id: string,
    @Body() body: { acknowledgedBy: string },
  ) {
    return this.alertsService.acknowledge(id, body.acknowledgedBy);
  }
}
