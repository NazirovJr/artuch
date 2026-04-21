import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { HotelService } from './hotel.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { Audit } from '../common/decorators/audit.decorator';

@Controller('v2/reservations')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class V2ReservationsController {
  constructor(private hotelService: HotelService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Reservation'))
  findAll() {
    return this.hotelService.findAllReservations();
  }

  /**
   * Calendar view source. /v2/reservations/calendar?from=&to=&roomNumber=
   * Returns the reservations that physically hold the room within [from,to).
   */
  @Get('calendar')
  @CheckPolicies((ability) => ability.can('read', 'Reservation'))
  calendar(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('roomNumber') roomNumber?: string,
  ) {
    if (!from || !to) {
      throw new BadRequestException('from and to are required');
    }
    return this.hotelService.findReservationsInRange(
      from,
      to,
      roomNumber ? parseInt(roomNumber, 10) : undefined,
    );
  }

  /**
   * Pre-flight conflict check used by NewReservationScreen before POST.
   * Returns the conflicting reservations; an empty array means it's safe.
   */
  @Get('conflicts')
  @CheckPolicies((ability) => ability.can('read', 'Reservation'))
  conflicts(
    @Query('roomNumber') roomNumber: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('excludeId') excludeId?: string,
  ) {
    if (!roomNumber || !from || !to) {
      throw new BadRequestException('roomNumber, from and to are required');
    }
    return this.hotelService.findConflicts(
      parseInt(roomNumber, 10),
      from,
      to,
      excludeId,
    );
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Reservation'))
  @Audit('create', 'Reservation')
  create(@Body() body: any, @Req() req: any) {
    return this.hotelService.createReservation(body, req.user?.id);
  }

  /**
   * Manual / cron-callable trigger for the 24h check-in reminder job.
   * Idempotent: it re-sends to anyone whose check-in is tomorrow.
   */
  @Post('send-checkin-reminders')
  @CheckPolicies((ability) => ability.can('update', 'Reservation'))
  @Audit('send-reminders', 'Reservation')
  sendCheckInReminders() {
    return this.hotelService.sendCheckInReminders();
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can('update', 'Reservation'))
  @Audit('update', 'Reservation')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.hotelService.updateReservation(id, body, req.user?.id);
  }
}
