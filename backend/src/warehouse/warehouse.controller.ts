import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Audit } from '../common/decorators/audit.decorator';

@Controller('warehouse')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarehouseController {
  constructor(private warehouseService: WarehouseService) {}

  @Get()
  @Roles('warehouse', 'admin')
  findAll() {
    return this.warehouseService.findAllItems();
  }

  @Get('transactions')
  @Roles('warehouse', 'admin')
  findTransactions() {
    return this.warehouseService.findAllTransactions();
  }

  @Post('transactions')
  @Roles('warehouse', 'admin')
  @Audit('create', 'WarehouseTransaction')
  createTransaction(@Body() body: any) {
    return this.warehouseService.createTransaction(body);
  }
}
