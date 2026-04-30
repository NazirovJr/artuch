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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import { Audit } from '../common/decorators/audit.decorator';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
} from './dto/supplier.dto';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class SuppliersController {
  constructor(private suppliersService: SuppliersService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Supplier'))
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.suppliersService.findAll(includeInactive === 'true');
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can('read', 'Supplier'))
  findById(@Param('id') id: string) {
    return this.suppliersService.findById(id);
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Supplier'))
  @Audit('create', 'Supplier')
  create(@Body() body: CreateSupplierDto) {
    return this.suppliersService.create(body);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can('update', 'Supplier'))
  @Audit('update', 'Supplier')
  update(@Param('id') id: string, @Body() body: UpdateSupplierDto) {
    return this.suppliersService.update(id, body);
  }

  @Delete(':id')
  @CheckPolicies((ability) => ability.can('delete', 'Supplier'))
  @Audit('delete', 'Supplier')
  remove(@Param('id') id: string) {
    return this.suppliersService.remove(id);
  }
}
