import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Folio } from './entities/folio.entity';
import { FolioCharge } from './entities/folio-charge.entity';
import { Guest } from '../hotel/entities/guest.entity';
import { FoliosService } from './folios.service';
import { FoliosController } from './folios.controller';
import { CaslModule } from '../casl/casl.module';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Folio, FolioCharge, Guest]),
    CaslModule,
    EventsModule,
    NotificationsModule,
  ],
  providers: [FoliosService],
  controllers: [FoliosController],
  exports: [FoliosService],
})
export class FoliosModule {}
