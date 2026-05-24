import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from './entities/room.entity';
import { RoomType } from './entities/room-type.entity';
import { Guest } from './entities/guest.entity';
import { Reservation } from './entities/reservation.entity';
import { BookingGroup } from './entities/booking-group.entity';
import { HotelService } from './hotel.service';
import { RoomTypesService } from './room-types.service';
import { BookingGroupsService } from './booking-groups.service';
import { RoomsController } from './rooms.controller';
import { GuestsController } from './guests.controller';
import { ReservationsController } from './reservations.controller';
import { V2RoomsController } from './v2-rooms.controller';
import { V2GuestsController } from './v2-guests.controller';
import { V2ReservationsController } from './v2-reservations.controller';
import { RoomTypesController } from './room-types.controller';
import { BookingGroupsController } from './booking-groups.controller';
import { CaslModule } from '../casl/casl.module';
import { EventsModule } from '../events/events.module';
import { FoliosModule } from '../folios/folios.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Room,
      RoomType,
      Guest,
      Reservation,
      BookingGroup,
    ]),
    CaslModule,
    EventsModule,
    FoliosModule,
    NotificationsModule,
  ],
  providers: [HotelService, RoomTypesService, BookingGroupsService],
  controllers: [
    RoomsController,
    GuestsController,
    ReservationsController,
    V2RoomsController,
    V2GuestsController,
    V2ReservationsController,
    RoomTypesController,
    BookingGroupsController,
  ],
})
export class HotelModule {}
