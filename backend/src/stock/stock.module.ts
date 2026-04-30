import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockLevel } from './entities/stock-level.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { StockLot } from './entities/stock-lot.entity';
import { UnitConversion } from './entities/unit-conversion.entity';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { LotsService } from './lots.service';
import { LotsController } from './lots.controller';
import { UnitConversionsService } from './unit-conversions.service';
import { UnitConversionsController } from './unit-conversions.controller';
import { CostingService } from './costing.service';
import { CostingController } from './costing.controller';
import { CaslModule } from '../casl/casl.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StockLevel,
      StockMovement,
      StockLot,
      UnitConversion,
    ]),
    CaslModule,
  ],
  providers: [
    StockService,
    LotsService,
    UnitConversionsService,
    CostingService,
  ],
  controllers: [
    StockController,
    LotsController,
    UnitConversionsController,
    CostingController,
  ],
  exports: [
    StockService,
    LotsService,
    UnitConversionsService,
    CostingService,
  ],
})
export class StockModule {}
