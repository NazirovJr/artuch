import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { Transaction } from '../pos/entities/transaction.entity';
import { Order } from '../restaurant/entities/order.entity';
import { Room } from '../hotel/entities/room.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { WarehouseItem } from '../warehouse/entities/warehouse-item.entity';
import { Reservation } from '../hotel/entities/reservation.entity';
import { Guest } from '../hotel/entities/guest.entity';
import { CaslModule } from '../casl/casl.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Order, Room, InventoryItem, WarehouseItem, Reservation, Guest]),
    CaslModule,
  ],
  providers: [SyncService],
  controllers: [SyncController],
})
export class SyncModule {}
