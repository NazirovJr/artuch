import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import { Audit } from '../common/decorators/audit.decorator';
import {
  CreateRoomTypeDto,
  UpdateRoomTypeDto,
} from './dto/room-type.dto';
import { RoomTypesService } from './room-types.service';

@Controller('room-types')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class RoomTypesController {
  constructor(private service: RoomTypesService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Room'))
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.service.findAll(includeInactive === 'true');
  }

  @Get('stats')
  @CheckPolicies((ability) => ability.can('read', 'Room'))
  stats() {
    return this.service.statsByType();
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can('read', 'Room'))
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  // Create/update/delete are admin-only — owners and admins can manage
  // the marketing/spec catalog; reception/cleaning have read-only access.
  @Post()
  @CheckPolicies((ability) => ability.can('manage', 'Room'))
  @Audit('create', 'RoomType')
  create(@Body() body: CreateRoomTypeDto) {
    return this.service.create(body);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can('manage', 'Room'))
  @Audit('update', 'RoomType')
  update(@Param('id') id: string, @Body() body: UpdateRoomTypeDto) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @CheckPolicies((ability) => ability.can('manage', 'Room'))
  @Audit('delete', 'RoomType')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
