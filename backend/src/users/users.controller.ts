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
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Audit } from '../common/decorators/audit.decorator';

/**
 * Payload shape for create/update. `role` is the string name (what CASL
 * uses) and `roleId` is the uuid — either (or both) may be sent and the
 * service will resolve the other via RolesService so the DB stays
 * consistent even if the client has only one of them handy.
 */
interface UserWritePayload {
  username?: string;
  password?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role?: string;
  roleId?: string;
  /** Plain PIN (4-6 digits). Hashed inside the service — never stored raw. */
  pin?: string;
  isActive?: boolean;
  /** Replace the set of outlets this user works at. */
  outletIds?: string[];
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles('owner', 'admin', 'manager')
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.usersService.findAll(includeInactive === 'true');
  }

  @Get(':id')
  @Roles('owner', 'admin', 'manager')
  findById(@Param('id') id: string) {
    return this.usersService.findByIdWithOutlets(id);
  }

  @Post()
  @Roles('owner', 'admin')
  @Audit('create', 'User')
  create(@Body() body: UserWritePayload) {
    return this.usersService.create(body);
  }

  @Patch(':id')
  @Roles('owner', 'admin')
  @Audit('update', 'User')
  update(@Param('id') id: string, @Body() body: UserWritePayload) {
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  @Audit('delete', 'User')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
