import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { HotelService } from './hotel.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('guests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GuestsController {
  constructor(private hotelService: HotelService) {}

  @Get()
  @Roles('reception', 'admin')
  findAll() {
    return this.hotelService.findAllGuests();
  }

  @Post()
  @Roles('reception')
  create(@Body() body: any) {
    return this.hotelService.createGuest(body);
  }
}
