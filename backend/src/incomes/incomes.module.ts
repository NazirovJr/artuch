import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Income } from './entities/income.entity';
import { IncomeCategory } from './entities/income-category.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { IncomesService } from './incomes.service';
import { IncomeCategoriesService } from './income-categories.service';
import { V2IncomesController } from './v2-incomes.controller';
import { V2IncomeCategoriesController } from './v2-income-categories.controller';
import { CaslModule } from '../casl/casl.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Income, IncomeCategory, Shift]),
    CaslModule,
    EventsModule,
  ],
  providers: [IncomesService, IncomeCategoriesService],
  controllers: [V2IncomesController, V2IncomeCategoriesController],
  exports: [IncomesService],
})
export class IncomesModule {}
