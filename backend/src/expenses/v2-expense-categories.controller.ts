import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ExpenseCategoriesService } from './expense-categories.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import {
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
} from './dto/expense.dto';

@Controller('v2/expense-categories')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class V2ExpenseCategoriesController {
  constructor(private readonly categories: ExpenseCategoriesService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'ExpenseCategory'))
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.categories.findAll(includeInactive === 'true');
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'ExpenseCategory'))
  @Audit('create', 'ExpenseCategory')
  create(@Body() body: CreateExpenseCategoryDto) {
    return this.categories.create(body);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can('update', 'ExpenseCategory'))
  @Audit('update', 'ExpenseCategory')
  update(@Param('id') id: string, @Body() body: UpdateExpenseCategoryDto) {
    return this.categories.update(id, body);
  }

  @Delete(':id')
  @CheckPolicies((ability) => ability.can('delete', 'ExpenseCategory'))
  @Audit('delete', 'ExpenseCategory')
  remove(@Param('id') id: string) {
    return this.categories.remove(id);
  }
}
