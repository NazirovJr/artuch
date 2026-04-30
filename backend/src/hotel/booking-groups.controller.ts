import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import { Audit } from '../common/decorators/audit.decorator';
import {
  AddGroupChargeDto,
  AddGroupPaymentDto,
  AddRoomToGroupDto,
  CancelBookingGroupDto,
  CreateBookingGroupDto,
  UpdateBookingGroupDto,
} from './dto/booking-group.dto';
import { BookingGroupsService } from './booking-groups.service';

@Controller('booking-groups')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class BookingGroupsController {
  constructor(private service: BookingGroupsService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'BookingGroup'))
  findAll(@Query('status') status?: string) {
    return this.service.findAll(status);
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can('read', 'BookingGroup'))
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Get(':id/statement')
  @CheckPolicies((ability) => ability.can('read', 'BookingGroup'))
  getStatement(@Param('id') id: string) {
    return this.service.getStatement(id);
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'BookingGroup'))
  @Audit('create', 'BookingGroup')
  create(@Body() body: CreateBookingGroupDto, @Request() req: any) {
    return this.service.create(body, req.user?.sub);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can('update', 'BookingGroup'))
  @Audit('update', 'BookingGroup')
  update(@Param('id') id: string, @Body() body: UpdateBookingGroupDto) {
    return this.service.update(id, body);
  }

  @Post(':id/rooms')
  @CheckPolicies((ability) => ability.can('update', 'BookingGroup'))
  @Audit('update', 'BookingGroup')
  addRoom(
    @Param('id') id: string,
    @Body() body: AddRoomToGroupDto,
    @Request() req: any,
  ) {
    return this.service.addRoom(id, body, req.user?.sub);
  }

  @Delete(':id/rooms/:reservationId')
  @CheckPolicies((ability) => ability.can('update', 'BookingGroup'))
  @Audit('update', 'BookingGroup')
  removeRoom(
    @Param('id') id: string,
    @Param('reservationId') reservationId: string,
  ) {
    return this.service.removeRoom(id, reservationId);
  }

  @Post(':id/charges')
  @CheckPolicies((ability) => ability.can('update', 'BookingGroup'))
  @Audit('create', 'FolioCharge')
  addCharge(
    @Param('id') id: string,
    @Body() body: AddGroupChargeDto,
    @Request() req: any,
  ) {
    return this.service.addCharge(id, body, req.user?.sub ?? 'system');
  }

  @Post(':id/payments')
  @CheckPolicies((ability) => ability.can('update', 'BookingGroup'))
  @Audit('create', 'FolioCharge')
  addPayment(
    @Param('id') id: string,
    @Body() body: AddGroupPaymentDto,
    @Request() req: any,
  ) {
    return this.service.addPayment(id, body, req.user?.sub ?? 'system');
  }

  @Post(':id/close')
  @CheckPolicies((ability) => ability.can('update', 'BookingGroup'))
  @Audit('update', 'BookingGroup')
  close(@Param('id') id: string) {
    return this.service.close(id);
  }

  @Post(':id/cancel')
  @CheckPolicies((ability) => ability.can('update', 'BookingGroup'))
  @Audit('update', 'BookingGroup')
  cancel(
    @Param('id') id: string,
    @Body() body: CancelBookingGroupDto,
    @Request() req: any,
  ) {
    return this.service.cancel(id, { cascade: body?.cascade }, req.user?.sub);
  }
}
