import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from './entities/room.entity';
import { Guest } from './entities/guest.entity';
import { Reservation } from './entities/reservation.entity';
import { HotelService } from './hotel.service';
import { RoomsController } from './rooms.controller';
import { GuestsController } from './guests.controller';
import { ReservationsController } from './reservations.controller';
import { V2RoomsController } from './v2-rooms.controller';
import { V2GuestsController } from './v2-guests.controller';
import { V2ReservationsController } from './v2-reservations.controller';
import { CaslModule } from '../casl/casl.module';
import { EventsModule } from '../events/events.module';
import { FoliosModule } from '../folios/folios.module';
import { CleaningModule } from '../cleaning/cleaning.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, Guest, Reservation]),
    CaslModule,
    EventsModule,
    FoliosModule,
    CleaningModule,
    NotificationsModule,
  ],
  providers: [HotelService],
  controllers: [
    RoomsController,
    GuestsController,
    ReservationsController,
    V2RoomsController,
    V2GuestsController,
    V2ReservationsController,
  ],
})
export class HotelModule {}
