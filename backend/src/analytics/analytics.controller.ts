import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';

@Controller('v2/analytics')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('revenue')
  @CheckPolicies((ability) => ability.can('read', 'Analytics'))
  getRevenue(@Query('period') period?: 'day' | 'week' | 'month') {
    return this.analyticsService.getRevenueStats(period);
  }

  @Get('top-items')
  @CheckPolicies((ability) => ability.can('read', 'Analytics'))
  getTopItems(@Query('limit') limit?: string) {
    return this.analyticsService.getTopItems(
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get('employee-stats')
  @CheckPolicies((ability) => ability.can('read', 'Analytics'))
  getEmployeeStats() {
    return this.analyticsService.getEmployeeStats();
  }

  @Get('room-occupancy')
  @CheckPolicies((ability) => ability.can('read', 'Analytics'))
  getRoomOccupancy() {
    return this.analyticsService.getRoomOccupancy();
  }

  @Get('kpi')
  @CheckPolicies((ability) => ability.can('read', 'Analytics'))
  getKpi() {
    return this.analyticsService.getKpiDashboard();
  }
}
