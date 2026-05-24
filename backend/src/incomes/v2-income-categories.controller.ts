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
import { IncomeCategoriesService } from './income-categories.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import {
  CreateIncomeCategoryDto,
  UpdateIncomeCategoryDto,
} from './dto/income.dto';

@Controller('v2/income-categories')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class V2IncomeCategoriesController {
  constructor(private readonly categories: IncomeCategoriesService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'IncomeCategory'))
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.categories.findAll(includeInactive === 'true');
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'IncomeCategory'))
  @Audit('create', 'IncomeCategory')
  create(@Body() body: CreateIncomeCategoryDto) {
    return this.categories.create(body);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can('update', 'IncomeCategory'))
  @Audit('update', 'IncomeCategory')
  update(@Param('id') id: string, @Body() body: UpdateIncomeCategoryDto) {
    return this.categories.update(id, body);
  }

  @Delete(':id')
  @CheckPolicies((ability) => ability.can('delete', 'IncomeCategory'))
  @Audit('delete', 'IncomeCategory')
  remove(@Param('id') id: string) {
    return this.categories.remove(id);
  }
}
