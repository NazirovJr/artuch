import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { HotelService } from './hotel.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReservationsController {
  constructor(private hotelService: HotelService) {}

  @Get()
  @Roles('reception', 'admin')
  findAll() {
    return this.hotelService.findAllReservations();
  }

  @Post()
  @Roles('reception', 'admin', 'owner')
  create(@Body() body: any) {
    return this.hotelService.createReservation(body);
  }

  @Patch(':id')
  @Roles('reception', 'admin', 'owner')
  update(@Param('id') id: string, @Body() body: any) {
    return this.hotelService.updateReservation(id, body);
  }
}
