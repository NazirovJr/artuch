import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import { Audit } from '../common/decorators/audit.decorator';
import {
  ApproveStocktakeDto,
  CancelStocktakeDto,
  CreateStocktakeDto,
  RecordCountDto,
} from './dto/stocktake.dto';
import { StocktakeService } from './stocktake.service';

@Controller('stocktakes')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class StocktakeController {
  constructor(private stocktakeService: StocktakeService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Stocktake'))
  findAll(
    @Query('warehouseId') warehouseId?: string,
    @Query('status') status?: string,
  ) {
    return this.stocktakeService.findAll(warehouseId, status);
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can('read', 'Stocktake'))
  findById(@Param('id') id: string) {
    return this.stocktakeService.findById(id);
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Stocktake'))
  @Audit('create', 'Stocktake')
  create(@Body() body: CreateStocktakeDto) {
    return this.stocktakeService.create(body);
  }

  @Patch(':id/lines/:lineId')
  @CheckPolicies((ability) => ability.can('update', 'StocktakeLine'))
  @Audit('update', 'StocktakeLine')
  recordCount(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: RecordCountDto,
  ) {
    return this.stocktakeService.recordCount(id, lineId, body);
  }

  @Post(':id/submit')
  @CheckPolicies((ability) => ability.can('update', 'Stocktake'))
  @Audit('update', 'Stocktake')
  submitForApproval(@Param('id') id: string) {
    return this.stocktakeService.submitForApproval(id);
  }

  // Approval requires manager-level rights — variances translate to ledger
  // writeoffs, which is a money-affecting operation.
  @Post(':id/approve')
  @CheckPolicies((ability) => ability.can('manage', 'Stocktake'))
  @Audit('update', 'Stocktake')
  approve(@Param('id') id: string, @Body() body: ApproveStocktakeDto) {
    return this.stocktakeService.approve(id, body);
  }

  @Post(':id/cancel')
  @CheckPolicies((ability) => ability.can('update', 'Stocktake'))
  @Audit('update', 'Stocktake')
  cancel(@Param('id') id: string, @Body() body: CancelStocktakeDto) {
    return this.stocktakeService.cancel(id, body);
  }
}
