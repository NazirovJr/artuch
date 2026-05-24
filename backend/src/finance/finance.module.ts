import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../pos/entities/transaction.entity';
import { Refund } from '../pos/entities/refund.entity';
import { Folio } from '../folios/entities/folio.entity';
import { FolioCharge } from '../folios/entities/folio-charge.entity';
import { Rental } from '../rentals/entities/rental.entity';
import { Reservation } from '../hotel/entities/reservation.entity';
import { Room } from '../hotel/entities/room.entity';
import { RoomType } from '../hotel/entities/room-type.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Income } from '../incomes/entities/income.entity';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { CaslModule } from '../casl/casl.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      Refund,
      Folio,
      FolioCharge,
      Rental,
      Reservation,
      Room,
      RoomType,
      Expense,
      Income,
    ]),
    CaslModule,
  ],
  providers: [FinanceService],
  controllers: [FinanceController],
})
export class FinanceModule {}
