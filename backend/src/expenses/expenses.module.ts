import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from './entities/expense.entity';
import { ExpenseCategory } from './entities/expense-category.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { ExpensesService } from './expenses.service';
import { ExpenseCategoriesService } from './expense-categories.service';
import { V2ExpensesController } from './v2-expenses.controller';
import { V2ExpenseCategoriesController } from './v2-expense-categories.controller';
import { CaslModule } from '../casl/casl.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Expense, ExpenseCategory, Shift]),
    CaslModule,
    EventsModule,
  ],
  providers: [ExpensesService, ExpenseCategoriesService],
  controllers: [V2ExpensesController, V2ExpenseCategoriesController],
  exports: [ExpensesService],
})
export class ExpensesModule {}
