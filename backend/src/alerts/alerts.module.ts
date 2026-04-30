import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LowStockAlert } from './entities/low-stock-alert.entity';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { CaslModule } from '../casl/casl.module';

@Module({
  imports: [TypeOrmModule.forFeature([LowStockAlert]), CaslModule],
  providers: [AlertsService],
  controllers: [AlertsController],
  exports: [AlertsService],
})
export class AlertsModule {}
