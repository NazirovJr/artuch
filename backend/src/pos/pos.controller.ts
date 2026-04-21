import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { PosService } from './pos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('pos/transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PosController {
  constructor(private posService: PosService) {}

  @Get()
  @Roles('shop-seller', 'bartender', 'owner', 'admin')
  findAll(@Query('type') type?: string) {
    return this.posService.findAll(type);
  }

  @Post()
  @Roles('shop-seller', 'bartender', 'owner', 'admin')
  create(@Body() body: any) {
    return this.posService.create(body);
  }
}
