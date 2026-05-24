import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { AlertsModule } from '../alerts/alerts.module';
import { CaslModule } from '../casl/casl.module';
import { StockModule } from '../stock/stock.module';
import { WarehouseItem } from '../warehouse/entities/warehouse-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryItem, InventoryMovement, WarehouseItem]),
    AlertsModule,
    CaslModule,
    StockModule,
  ],
  providers: [InventoryService],
  controllers: [InventoryController],
  exports: [InventoryService],
})
export class InventoryModule {}
