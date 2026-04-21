import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuItem } from './entities/menu-item.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderEditLog } from './entities/order-edit-log.entity';
import { RestaurantService } from './restaurant.service';
import { MenuController } from './menu.controller';
import { OrdersController } from './orders.controller';
import { V2OrdersController } from './v2-orders.controller';
import { V2MenuController } from './v2-menu.controller';
import { CaslModule } from '../casl/casl.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MenuItem, Order, OrderItem, OrderEditLog]),
    CaslModule,
    EventsModule,
  ],
  providers: [RestaurantService],
  controllers: [MenuController, OrdersController, V2OrdersController, V2MenuController],
})
export class RestaurantModule {}
