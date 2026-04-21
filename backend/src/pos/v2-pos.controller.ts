import { Controller, Get, Post, Body, Query, Req, UseGuards } from '@nestjs/common';
import { PosService } from './pos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { RequireManagerPin } from '../common/decorators/require-manager-pin.decorator';
import { ManagerApprovalGuard } from '../common/guards/manager-approval.guard';

@Controller('v2/pos')
@UseGuards(JwtAuthGuard, PoliciesGuard, ManagerApprovalGuard)
export class V2PosController {
  constructor(private posService: PosService) {}

  @Get('transactions')
  @CheckPolicies((ability) => ability.can('read', 'Transaction'))
  findAll(@Query('type') type?: string, @Query('outletId') outletId?: string) {
    return this.posService.findAll(type);
  }

  @Post('transactions')
  @CheckPolicies((ability) => ability.can('create', 'Transaction'))
  @Audit('create', 'Transaction')
  create(@Body() body: any) {
    return this.posService.create(body);
  }

  @Post('refunds')
  @CheckPolicies((ability) => ability.can('create', 'Refund'))
  @RequireManagerPin('refund')
  @Audit('create', 'Refund')
  createRefund(@Body() body: any, @Req() req: any) {
    return this.posService.createRefund({ ...body, approval: req.managerApproval });
  }

  @Get('refunds')
  @CheckPolicies((ability) => ability.can('read', 'Refund'))
  findRefunds() {
    return this.posService.findAllRefunds();
  }
}
