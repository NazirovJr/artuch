import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { RestaurantService } from './restaurant.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { Audit } from '../common/decorators/audit.decorator';

@Controller('v2/menu')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class V2MenuController {
  constructor(private restaurantService: RestaurantService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'MenuItem'))
  findAll() {
    return this.restaurantService.findAllMenuItems();
  }

  /** Admin list — includes inactive items. */
  @Get('all')
  @CheckPolicies((ability) => ability.can('read', 'MenuItem'))
  findAllAdmin() {
    return this.restaurantService.findAllMenuItemsAdmin();
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'MenuItem'))
  @Audit('create', 'MenuItem')
  create(@Body() body: any) {
    return this.restaurantService.createMenuItem(body);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can('update', 'MenuItem'))
  @Audit('update', 'MenuItem')
  update(@Param('id') id: string, @Body() body: any) {
    return this.restaurantService.updateMenuItem(id, body);
  }
}
