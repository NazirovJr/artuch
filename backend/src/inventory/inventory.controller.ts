import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import { Audit } from '../common/decorators/audit.decorator';

@Controller('inventory')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'InventoryItem'))
  findAll(@Query('category') category?: string) {
    return this.inventoryService.findAllItems(category);
  }

  // Static sub-routes MUST come before the generic `:id` wildcard, otherwise
  // NestJS matches e.g. GET /inventory/movements as id='movements'.
  @Get('movements')
  @CheckPolicies((ability) => ability.can('read', 'InventoryMovement'))
  findMovements() {
    return this.inventoryService.findAllMovements();
  }

  @Post('movements')
  @CheckPolicies((ability) => ability.can('create', 'InventoryMovement'))
  @Audit('create', 'InventoryMovement')
  addMovement(@Body() body: any) {
    return this.inventoryService.addMovement(body);
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can('read', 'InventoryItem'))
  findOne(@Param('id') id: string) {
    return this.inventoryService.findItemById(id);
  }

  @Post(':id/receive-from-warehouse')
  @CheckPolicies((ability) => ability.can('update', 'InventoryItem'))
  @Audit('receive-from-warehouse', 'InventoryItem', 'id')
  receiveFromWarehouse(
    @Param('id') id: string,
    @Body() body: { quantity: number },
    @Req() req: any,
  ) {
    return this.inventoryService.receiveFromWarehouse(id, body.quantity, {
      id: req.user.id || req.user.sub,
      name: req.user.username || req.user.name,
    });
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'InventoryItem'))
  @Audit('create', 'InventoryItem')
  create(@Body() body: any) {
    return this.inventoryService.createItem(body);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can('update', 'InventoryItem'))
  @Audit('update', 'InventoryItem')
  update(@Param('id') id: string, @Body() body: any) {
    return this.inventoryService.updateItem(id, body);
  }
}
