import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuItem } from './entities/menu-item.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderEditLog } from './entities/order-edit-log.entity';
import { RestaurantCheck } from './entities/restaurant-check.entity';
import { Transaction } from '../pos/entities/transaction.entity';
import { TransactionItem } from '../pos/entities/transaction-item.entity';
import { RestaurantService } from './restaurant.service';
import { ChecksService } from './checks.service';
import { MenuController } from './menu.controller';
import { OrdersController } from './orders.controller';
import { V2OrdersController } from './v2-orders.controller';
import { V2MenuController } from './v2-menu.controller';
import { V2ChecksController } from './v2-checks.controller';
import { V2KdsController } from './v2-kds.controller';
import { CaslModule } from '../casl/casl.module';
import { EventsModule } from '../events/events.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { FoliosModule } from '../folios/folios.module';
import { OutletsModule } from '../outlets/outlets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MenuItem, Order, OrderItem, OrderEditLog, RestaurantCheck, Transaction, TransactionItem]),
    CaslModule,
    EventsModule,
    ShiftsModule, // settle cash/card requires an active shift + feeds till variance
    FoliosModule, // settle to room posts a 'restaurant' folio charge
    OutletsModule, // resolves the restaurant outlet for the transaction
  ],
  providers: [RestaurantService, ChecksService],
  controllers: [MenuController, OrdersController, V2OrdersController, V2MenuController, V2ChecksController, V2KdsController],
})
export class RestaurantModule {}
