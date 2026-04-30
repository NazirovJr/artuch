import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rental } from './entities/rental.entity';
import { RentalsService } from './rentals.service';
import { RentalsController } from './rentals.controller';
import { CaslModule } from '../casl/casl.module';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Rental, InventoryItem, InventoryMovement]),
    CaslModule,
    StockModule,
  ],
  providers: [RentalsService],
  controllers: [RentalsController],
  exports: [RentalsService],
})
export class RentalsModule {}
