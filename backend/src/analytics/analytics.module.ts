import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../pos/entities/transaction.entity';
import { Order } from '../restaurant/entities/order.entity';
import { Room } from '../hotel/entities/room.entity';
import { Reservation } from '../hotel/entities/reservation.entity';
import { Refund } from '../pos/entities/refund.entity';
import { FolioCharge } from '../folios/entities/folio-charge.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { OrderEditLog } from '../restaurant/entities/order-edit-log.entity';
import { CleaningTask } from '../cleaning/entities/cleaning-task.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { ExceptionsService } from './exceptions.service';
import { ExceptionsController } from './exceptions.controller';
import { CaslModule } from '../casl/casl.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      Order,
      Room,
      Reservation,
      Refund,
      FolioCharge,
      Shift,
      OrderEditLog,
      CleaningTask,
      AuditLog,
    ]),
    CaslModule,
  ],
  providers: [AnalyticsService, ExceptionsService],
  controllers: [AnalyticsController, ExceptionsController],
})
export class AnalyticsModule {}
