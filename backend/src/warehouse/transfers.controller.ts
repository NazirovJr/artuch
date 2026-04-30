import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import { Audit } from '../common/decorators/audit.decorator';
import {
  CancelTransferDto,
  CreateTransferDto,
  ReceiveTransferDto,
} from './dto/create-transfer.dto';
import { TransfersService } from './transfers.service';

@Controller('warehouse/transfers')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class TransfersController {
  constructor(private transfersService: TransfersService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'StockTransfer'))
  findAll(@Query('status') status?: string) {
    return this.transfersService.findAll(status);
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can('read', 'StockTransfer'))
  findById(@Param('id') id: string) {
    return this.transfersService.findById(id);
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'StockTransfer'))
  @Audit('create', 'StockTransfer')
  create(@Body() body: CreateTransferDto) {
    return this.transfersService.create(body);
  }

  @Post(':id/receive')
  @CheckPolicies((ability) => ability.can('update', 'StockTransfer'))
  @Audit('update', 'StockTransfer')
  receive(@Param('id') id: string, @Body() body: ReceiveTransferDto) {
    return this.transfersService.receive(id, body);
  }

  @Post(':id/cancel')
  @CheckPolicies((ability) => ability.can('update', 'StockTransfer'))
  @Audit('update', 'StockTransfer')
  cancel(@Param('id') id: string, @Body() body: CancelTransferDto) {
    return this.transfersService.cancel(id, body);
  }
}
