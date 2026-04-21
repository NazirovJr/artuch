import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Audit } from '../common/decorators/audit.decorator';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get()
  // Everyone who can create or edit a staff member needs this list to fill
  // the "Role" dropdown. Write operations below stay admin-only.
  @Roles('owner', 'admin', 'manager')
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @Roles('owner', 'admin', 'manager')
  findOne(@Param('id') id: string) {
    return this.rolesService.findById(id);
  }

  @Post()
  @Roles('admin')
  @Audit('create', 'Role')
  create(@Body() body: any) {
    return this.rolesService.create(body);
  }

  @Patch(':id')
  @Roles('admin')
  @Audit('update', 'Role')
  update(@Param('id') id: string, @Body() body: any) {
    return this.rolesService.update(id, body);
  }

  @Post(':id/permissions')
  @Roles('admin')
  @Audit('add-permission', 'Role')
  addPermission(@Param('id') id: string, @Body() body: any) {
    return this.rolesService.addPermission(id, body);
  }

  @Delete('permissions/:permId')
  @Roles('admin')
  @Audit('remove-permission', 'Role', 'permId')
  removePermission(@Param('permId') permId: string) {
    return this.rolesService.removePermission(permId);
  }
}
