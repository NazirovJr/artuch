import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('v2/sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private syncService: SyncService) {}

  @Post('pull')
  pull(@Body() body: { lastSyncAt?: string }) {
    return this.syncService.pull(body.lastSyncAt);
  }

  @Post('push')
  push(@Body() body: any) {
    return this.syncService.push(body);
  }
}
