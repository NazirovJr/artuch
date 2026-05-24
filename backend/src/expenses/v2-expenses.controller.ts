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
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { CreateExpenseDto, VoidExpenseDto } from './dto/expense.dto';

@Controller('v2/expenses')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class V2ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Expense'))
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
    return this.expenses.list({
      from, to, categoryId, group, outletId, paymentMethod, status, q,
    });
  }

  @Get('summary')
  @CheckPolicies((ability) => ability.can('read', 'Expense'))
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
    return this.expenses.summary({
      from, to, categoryId, group, outletId, paymentMethod, status, q,
    });
  }

  @Get('export.xlsx')
  @CheckPolicies((ability) => ability.can('read', 'Expense'))
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
    const buffer = await this.expenses.buildWorkbook({
      from, to, categoryId, group, outletId, paymentMethod, status, q,
    });
    const stamp = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="artuch-expenses-${stamp}.xlsx"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Expense'))
  @Audit('create', 'Expense')
  create(@Body() body: CreateExpenseDto, @Req() req: any) {
    return this.expenses.create(body, {
      id: req.user.id || req.user.sub,
      name: req.user.username,
    });
  }

  @Patch(':id/void')
  @CheckPolicies((ability) => ability.can('delete', 'Expense'))
  @Audit('void', 'Expense')
  void(@Param('id') id: string, @Body() body: VoidExpenseDto, @Req() req: any) {
    return this.expenses.void(id, body?.reason, {
      id: req.user.id || req.user.sub,
      name: req.user.username,
    });
  }
}
