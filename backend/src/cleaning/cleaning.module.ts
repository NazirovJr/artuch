import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CleaningTask } from './entities/cleaning-task.entity';
import { CleaningChecklistTemplate } from './entities/cleaning-checklist-template.entity';
import { Reservation } from '../hotel/entities/reservation.entity';
import { Room } from '../hotel/entities/room.entity';
import { User } from '../users/entities/user.entity';
import { CleaningService } from './cleaning.service';
import { CleaningController } from './cleaning.controller';
import { CaslModule } from '../casl/casl.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CleaningTask,
      CleaningChecklistTemplate,
      Reservation,
      Room,
      User,
    ]),
    CaslModule,
    EventsModule,
  ],
  providers: [CleaningService],
  controllers: [CleaningController],
  exports: [CleaningService],
})
export class CleaningModule {}
