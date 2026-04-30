import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WarehouseItem } from './entities/warehouse-item.entity';
import { WarehouseTransaction } from './entities/warehouse-transaction.entity';
import { StockTransfer } from './entities/stock-transfer.entity';
import { WarehouseService } from './warehouse.service';
import { WarehouseController } from './warehouse.controller';
import { TransfersService } from './transfers.service';
import { TransfersController } from './transfers.controller';
import { AlertsModule } from '../alerts/alerts.module';
import { CaslModule } from '../casl/casl.module';
import { StockModule } from '../stock/stock.module';
import { SuppliersModule } from '../suppliers/suppliers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WarehouseItem,
      WarehouseTransaction,
      StockTransfer,
    ]),
    AlertsModule,
    CaslModule,
    StockModule,
    SuppliersModule,
  ],
  providers: [WarehouseService, TransfersService],
  controllers: [WarehouseController, TransfersController],
  exports: [WarehouseService, TransfersService],
})
export class WarehouseModule {}
