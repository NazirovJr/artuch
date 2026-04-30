import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import { Audit } from '../common/decorators/audit.decorator';
import { CreateWarehouseTransactionDto } from './dto/create-warehouse-transaction.dto';
import { CreateWarehouseItemDto } from './dto/create-warehouse-item.dto';

@Controller('warehouse')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class WarehouseController {
  constructor(private warehouseService: WarehouseService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'WarehouseItem'))
  findAll() {
    return this.warehouseService.findAllItems();
  }

  @Get('categories')
  @CheckPolicies((ability) => ability.can('read', 'WarehouseItem'))
  findCategories() {
    return this.warehouseService.findCategories();
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'WarehouseItem'))
  @Audit('create', 'WarehouseItem')
  createItem(@Body() body: CreateWarehouseItemDto, @Request() req: any) {
    return this.warehouseService.createItem(body, req.user?.sub);
  }

  // Barcode lookup — used by the scan-to-prefill flow on the staff app.
  // Returns 404 when no item matches so the client can show a "not found"
  // hint and offer to create the SKU.
  @Get('lookup')
  @CheckPolicies((ability) => ability.can('read', 'WarehouseItem'))
  async lookupByBarcode(
    @Query('barcode') barcode: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    const item = await this.warehouseService.findByBarcode(
      barcode,
      warehouseId,
    );
    if (!item) {
      throw new NotFoundException(
        `No item with barcode "${barcode}"${
          warehouseId ? ` in this warehouse` : ''
        }`,
      );
    }
    return item;
  }

  @Get('transactions')
  @CheckPolicies((ability) => ability.can('read', 'WarehouseTransaction'))
  findTransactions() {
    return this.warehouseService.findAllTransactions();
  }

  @Post('transactions')
  @CheckPolicies((ability) => ability.can('create', 'WarehouseTransaction'))
  @Audit('create', 'WarehouseTransaction')
  createTransaction(@Body() body: CreateWarehouseTransactionDto) {
    return this.warehouseService.createTransaction(body);
  }
}
