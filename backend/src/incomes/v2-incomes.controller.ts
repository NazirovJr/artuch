import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { IncomesService } from './incomes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { CreateIncomeDto, VoidIncomeDto } from './dto/income.dto';

@Controller('v2/incomes')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class V2IncomesController {
  constructor(private readonly incomes: IncomesService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Income'))
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('categoryId') categoryId?: string,
    @Query('group') group?: string,
    @Query('outletId') outletId?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.incomes.list({
      from, to, categoryId, group, outletId, paymentMethod, status, q,
    });
  }

  @Get('summary')
  @CheckPolicies((ability) => ability.can('read', 'Income'))
  summary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('categoryId') categoryId?: string,
    @Query('group') group?: string,
    @Query('outletId') outletId?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.incomes.summary({
      from, to, categoryId, group, outletId, paymentMethod, status, q,
    });
  }

  @Get('export.xlsx')
  @CheckPolicies((ability) => ability.can('read', 'Income'))
  async export(
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('categoryId') categoryId?: string,
    @Query('group') group?: string,
    @Query('outletId') outletId?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    const buffer = await this.incomes.buildWorkbook({
      from, to, categoryId, group, outletId, paymentMethod, status, q,
    });
    const stamp = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="artuch-incomes-${stamp}.xlsx"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Income'))
  @Audit('create', 'Income')
  create(@Body() body: CreateIncomeDto, @Req() req: any) {
    return this.incomes.create(body, {
      id: req.user.id || req.user.sub,
      name: req.user.username,
    });
  }

  @Patch(':id/void')
  @CheckPolicies((ability) => ability.can('delete', 'Income'))
  @Audit('void', 'Income')
  void(@Param('id') id: string, @Body() body: VoidIncomeDto, @Req() req: any) {
    return this.incomes.void(id, body?.reason, {
      id: req.user.id || req.user.sub,
      name: req.user.username,
    });
  }
}
