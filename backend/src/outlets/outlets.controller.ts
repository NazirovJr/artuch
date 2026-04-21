import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { OutletsService } from './outlets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { Audit } from '../common/decorators/audit.decorator';

@Controller('outlets')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class OutletsController {
  constructor(private outletsService: OutletsService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Outlet'))
  findAll() {
    return this.outletsService.findAll();
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can('read', 'Outlet'))
  findOne(@Param('id') id: string) {
    return this.outletsService.findById(id);
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Outlet'))
  @Audit('create', 'Outlet')
  create(@Body() body: any) {
    return this.outletsService.create(body);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can('update', 'Outlet'))
  @Audit('update', 'Outlet')
  update(@Param('id') id: string, @Body() body: any) {
    return this.outletsService.update(id, body);
  }

  @Delete(':id')
  @CheckPolicies((ability) => ability.can('delete', 'Outlet'))
  @Audit('delete', 'Outlet')
  remove(@Param('id') id: string) {
    return this.outletsService.remove(id);
  }

  @Post(':id/users/:userId')
  @CheckPolicies((ability) => ability.can('manage', 'Outlet'))
  @Audit('assign-user', 'Outlet')
  assignUser(@Param('id') id: string, @Param('userId') userId: string) {
    return this.outletsService.assignUser(id, userId);
  }

  @Delete(':id/users/:userId')
  @CheckPolicies((ability) => ability.can('manage', 'Outlet'))
  @Audit('unassign-user', 'Outlet')
  unassignUser(@Param('id') id: string, @Param('userId') userId: string) {
    return this.outletsService.unassignUser(id, userId);
  }

  @Get(':id/users')
  @CheckPolicies((ability) => ability.can('read', 'Outlet'))
  getUsers(@Param('id') id: string) {
    return this.outletsService.getUsersForOutlet(id);
  }
}
