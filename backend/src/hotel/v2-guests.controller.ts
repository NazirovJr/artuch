import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { HotelService } from './hotel.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { Audit } from '../common/decorators/audit.decorator';

@Controller('v2/guests')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class V2GuestsController {
  constructor(private hotelService: HotelService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Guest'))
  findAll() {
    return this.hotelService.findAllGuests();
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can('read', 'Guest'))
  findById(@Param('id') id: string) {
    return this.hotelService.findGuestById(id);
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Guest'))
  @Audit('create', 'Guest')
  create(@Body() body: any) {
    return this.hotelService.createGuest(body);
  }
}
