import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SystemSettings } from './entities/system-settings.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /** Public — app fetches on boot for branding */
  @Get()
  get(): Promise<SystemSettings> {
    return this.settingsService.get();
  }

  /** Admin/owner only — upsert global settings */
  @Patch()
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @CheckPolicies((ability) => ability.can('manage', 'all'))
  update(@Body() body: Partial<Omit<SystemSettings, 'id' | 'updatedAt'>>): Promise<SystemSettings> {
    return this.settingsService.update(body);
  }
}
