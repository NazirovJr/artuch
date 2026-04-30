import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { HotelService } from './hotel.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import {
  BulkCreateRoomsDto,
  CreateRoomDto,
  UpdateRoomDtoExtended,
} from './dto/create-room.dto';

@Controller('v2/rooms')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class V2RoomsController {
  constructor(private hotelService: HotelService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Room'))
  findAll() {
    return this.hotelService.findAllRooms();
  }

  @Get(':number')
  @CheckPolicies((ability) => ability.can('read', 'Room'))
  findOne(@Param('number') number: string) {
    return this.hotelService.findRoomByNumber(parseInt(number, 10));
  }

  // Create/delete require manage Room — owner/admin/manager only.
  // Reception keeps update access via the existing CASL grants for
  // status / cleaning transitions.
  @Post()
  @CheckPolicies((ability) => ability.can('manage', 'Room'))
  @Audit('create', 'Room', 'number')
  create(@Body() body: CreateRoomDto) {
    return this.hotelService.createRoom(body);
  }

  @Post('bulk')
  @CheckPolicies((ability) => ability.can('manage', 'Room'))
  @Audit('create', 'Room')
  bulkCreate(@Body() body: BulkCreateRoomsDto) {
    return this.hotelService.bulkCreateRooms(body);
  }

  @Patch(':number')
  @CheckPolicies((ability) => ability.can('update', 'Room'))
  @Audit('update', 'Room', 'number')
  update(
    @Param('number') number: string,
    @Body() body: UpdateRoomDtoExtended,
  ) {
    return this.hotelService.updateRoom(parseInt(number, 10), body);
  }

  @Delete(':number')
  @CheckPolicies((ability) => ability.can('manage', 'Room'))
  @Audit('delete', 'Room', 'number')
  remove(@Param('number') number: string) {
    return this.hotelService.deleteRoom(parseInt(number, 10));
  }
}
