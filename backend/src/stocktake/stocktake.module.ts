import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Stocktake } from './entities/stocktake.entity';
import { StocktakeLine } from './entities/stocktake-line.entity';
import { WarehouseItem } from '../warehouse/entities/warehouse-item.entity';
import { WarehouseTransaction } from '../warehouse/entities/warehouse-transaction.entity';
import { StocktakeService } from './stocktake.service';
import { StocktakeController } from './stocktake.controller';
import { CaslModule } from '../casl/casl.module';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Stocktake,
      StocktakeLine,
      WarehouseItem,
      WarehouseTransaction,
    ]),
    CaslModule,
    StockModule,
  ],
  providers: [StocktakeService],
  controllers: [StocktakeController],
  exports: [StocktakeService],
})
export class StocktakeModule {}
