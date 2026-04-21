import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';

@Controller('v2/audit-log')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'AuditLog'))
  findAll(
    @Query('userId') userId?: string,
    @Query('subject') subject?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.auditService.findAll({ userId, subject, from, to });
  }
}
