import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceToken } from './entities/device-token.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { OutboundMessageService } from './outbound-message.service';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceToken, User])],
  controllers: [NotificationsController],
  providers: [NotificationsService, OutboundMessageService],
  exports: [NotificationsService, OutboundMessageService],
})
export class NotificationsModule {}
