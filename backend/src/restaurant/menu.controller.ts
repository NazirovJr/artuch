import { Controller, Get } from '@nestjs/common';
import { RestaurantService } from './restaurant.service';

@Controller('menu')
export class MenuController {
  constructor(private restaurantService: RestaurantService) {}

  @Get()
  findAll() {
    return this.restaurantService.findAllMenuItems();
  }
}
