import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { RestaurantService } from './restaurant.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private restaurantService: RestaurantService) {}

  @Get()
  @Roles('waiter', 'cook', 'admin')
  findAll(@Query('status') status?: string) {
    return this.restaurantService.findAllOrders(status);
  }

  @Post()
  @Roles('waiter', 'admin', 'owner')
  create(@Body() body: any) {
    return this.restaurantService.createOrder(body);
  }

  @Patch(':id/status')
  @Roles('waiter', 'cook', 'admin')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.restaurantService.updateOrderStatus(id, body.status);
  }
}
