import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ChecksService } from './checks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { RequireManagerPin } from '../common/decorators/require-manager-pin.decorator';
import { ManagerApprovalGuard } from '../common/guards/manager-approval.guard';
import { scopeFilter, assertCanAct } from '../casl/ownership';

@Controller('v2/checks')
@UseGuards(JwtAuthGuard, PoliciesGuard, ManagerApprovalGuard)
export class V2ChecksController {
  constructor(private readonly checksService: ChecksService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Check'))
  findOpen(@Req() req: any) {
    const scope = scopeFilter(
      req.ability,
      'read',
      'Check',
      'openedBy',
      req.user.id || req.user.sub,
    );
    return this.checksService.findOpenChecks(scope);
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can('read', 'Check'))
  async getOne(@Param('id') id: string, @Req() req: any) {
    const check = await this.checksService.getCheck(id);
    assertCanAct(req.ability, 'read', 'Check', check);
    return check;
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Check'))
  @Audit('open', 'Check')
  open(@Body() body: any, @Req() req: any) {
    return this.checksService.openCheck(
      {
        tableNumber: body.tableNumber,
        openedBy: req.user.id || req.user.sub,
        openedByName: body.openedByName || req.user.username,
        guestId: body.guestId,
        guestCount: body.guestCount,
      },
      req.ability,
    );
  }

  @Post(':id/rounds')
  @CheckPolicies((ability) => ability.can('update', 'Check'))
  @Audit('add-round', 'Check', 'checkId')
  addRound(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.checksService.addRound(
      id,
      {
        items: body.items,
        waiterId: req.user.id || req.user.sub,
        waiterName: body.waiterName || req.user.username,
      },
      req.ability,
    );
  }

  @Post(':id/settle')
  @CheckPolicies((ability) => ability.can('update', 'Check'))
  @Audit('settle', 'Check')
  settle(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.checksService.settle(
      id,
      {
        method: body.method,
        folioId: body.folioId,
        employeeId: req.user.id || req.user.sub,
        employeeName: body.employeeName || req.user.username,
        outletId: body.outletId,
      },
      req.ability,
    );
  }

  @Patch(':id/cancel')
  @CheckPolicies((ability) => ability.can('delete', 'Check'))
  @RequireManagerPin('check-cancel')
  @Audit('cancel', 'Check')
  cancel(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.checksService.cancelCheck(id, body?.reason, req.ability);
  }
}
