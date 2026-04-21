import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { HotelService } from './hotel.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('rooms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoomsController {
  constructor(private hotelService: HotelService) {}

  @Get()
  @Roles('reception', 'cleaning', 'admin')
  findAll() {
    return this.hotelService.findAllRooms();
  }

  @Patch(':number')
  @Roles('reception', 'cleaning')
  update(@Param('number') number: number, @Body() body: any) {
    return this.hotelService.updateRoom(+number, body);
  }
}
