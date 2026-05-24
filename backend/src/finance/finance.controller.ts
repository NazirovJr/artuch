import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';

@Controller('v2/finance')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('summary')
  @CheckPolicies((ability) => ability.can('read', 'Analytics'))
  summary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('outletId') outletId?: string,
    @Query('paymentMethod') paymentMethod?: string,
  ) {
    return this.finance.getSummary(from, to, { outletId, paymentMethod });
  }

  @Get('export.xlsx')
  @CheckPolicies((ability) => ability.can('read', 'Analytics'))
  async export(
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('scope') scope?: string,
    @Query('outletId') outletId?: string,
    @Query('paymentMethod') paymentMethod?: string,
  ) {
    const summary = await this.finance.getSummary(from, to, {
      outletId,
      paymentMethod,
    });
    const lens =
      scope === 'income' || scope === 'expense' ? scope : 'all';
    const buffer = await this.finance.buildWorkbook(summary, lens);
    const stamp = new Date().toISOString().slice(0, 10);
    const tag = lens === 'all' ? '' : `-${lens}`;
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="artuch-finance${tag}-${stamp}.xlsx"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }
}
