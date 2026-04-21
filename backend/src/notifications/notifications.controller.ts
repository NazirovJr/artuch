import { Controller, Post, Delete, Body, UseGuards, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('v2/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post('register')
  register(@Req() req: any, @Body() body: { token: string; platform?: string }) {
    return this.notificationsService.registerToken(req.user.id, body.token, body.platform);
  }

  @Delete('unregister')
  unregister(@Req() req: any) {
    return this.notificationsService.unregisterToken(req.user.id);
  }
}
