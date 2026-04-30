import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LowStockAlert } from '../alerts/entities/low-stock-alert.entity';
import { CaslModule } from '../casl/casl.module';
import { StockLot } from '../stock/entities/stock-lot.entity';
import { StockTransfer } from '../warehouse/entities/stock-transfer.entity';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([StockTransfer, LowStockAlert, StockLot]),
    CaslModule,
    WarehouseModule,
  ],
  providers: [MaintenanceService],
  controllers: [MaintenanceController],
})
export class MaintenanceModule {}
