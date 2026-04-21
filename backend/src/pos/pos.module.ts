import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { TransactionItem } from './entities/transaction-item.entity';
import { Refund } from './entities/refund.entity';
import { PosService } from './pos.service';
import { PosController } from './pos.controller';
import { V2PosController } from './v2-pos.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { CaslModule } from '../casl/casl.module';
import { EventsModule } from '../events/events.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { FoliosModule } from '../folios/folios.module';
import { OutletsModule } from '../outlets/outlets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, TransactionItem, Refund]),
    InventoryModule,
    CaslModule,
    EventsModule,
    ShiftsModule,
    FoliosModule, // POS can post charges onto a guest's folio (paymentMethod='folio')
    OutletsModule, // Resolves outlet.type -> folio chargeType (shop / restaurant / bar / rental)
  ],
  providers: [PosService],
  controllers: [PosController, V2PosController],
})
export class PosModule {}
