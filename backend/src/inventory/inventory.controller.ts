import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Audit } from '../common/decorators/audit.decorator';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get()
  @Roles('shop-seller', 'bartender', 'owner', 'admin')
  findAll(@Query('category') category?: string) {
    return this.inventoryService.findAllItems(category);
  }

  @Post()
  @Roles('owner', 'admin')
  @Audit('create', 'InventoryItem')
  create(@Body() body: any) {
    return this.inventoryService.createItem(body);
  }

  @Patch(':id')
  @Roles('owner', 'admin')
  @Audit('update', 'InventoryItem')
  update(@Param('id') id: string, @Body() body: any) {
    return this.inventoryService.updateItem(id, body);
  }

  @Get('movements')
  @Roles('shop-seller', 'bartender', 'owner', 'admin')
  findMovements() {
    return this.inventoryService.findAllMovements();
  }

  @Post('movements')
  @Roles('shop-seller', 'bartender', 'owner', 'admin')
  @Audit('create', 'InventoryMovement')
  addMovement(@Body() body: any) {
    return this.inventoryService.addMovement(body);
  }
}
