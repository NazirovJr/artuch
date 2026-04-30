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
}
