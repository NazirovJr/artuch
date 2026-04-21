import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { HotelService } from './hotel.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { Audit } from '../common/decorators/audit.decorator';

@Controller('v2/rooms')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class V2RoomsController {
  constructor(private hotelService: HotelService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Room'))
  findAll() {
    return this.hotelService.findAllRooms();
  }

  @Patch(':number')
  @CheckPolicies((ability) => ability.can('update', 'Room'))
  @Audit('update', 'Room', 'number')
  update(@Param('number') number: string, @Body() body: any) {
    return this.hotelService.updateRoom(parseInt(number, 10), body);
  }
}
