import { Controller, Get, UseGuards } from '@nestjs/common';
import { RestaurantService } from './restaurant.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';

@Controller('v2/menu')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class V2MenuController {
  constructor(private restaurantService: RestaurantService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'MenuItem'))
  findAll() {
    return this.restaurantService.findAllMenuItems();
  }
}
