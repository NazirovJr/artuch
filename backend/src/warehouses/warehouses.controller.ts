import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';

@Controller('warehouses')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class WarehousesController {
  constructor(private warehousesService: WarehousesService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Warehouse'))
  findAll() {
    return this.warehousesService.findAll();
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can('read', 'Warehouse'))
  findById(@Param('id') id: string) {
    return this.warehousesService.findById(id);
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Warehouse'))
  create(@Body() data: CreateWarehouseDto) {
    return this.warehousesService.create(data);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can('update', 'Warehouse'))
  update(@Param('id') id: string, @Body() data: UpdateWarehouseDto) {
    return this.warehousesService.update(id, data);
  }

  @Delete(':id')
  @CheckPolicies((ability) => ability.can('delete', 'Warehouse'))
  remove(@Param('id') id: string) {
    return this.warehousesService.remove(id);
  }
}
