import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSettings } from './entities/system-settings.entity';

// Fallback values matching the existing hotel.ts constants so
// existing deploys don't see blank fields on first boot.
const DEFAULTS: Partial<SystemSettings> = {
  hotelName: 'Artuch Travel',
  hotelAddress: 'Таджикистан, Согдийская область, Фанские горы',
  hotelPhone: '+992 44 000 00 00',
  hotelEmail: 'info@artuch.travel',
  hotelWebsite: 'artuch.travel',
  currency: 'TJS',
};

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SystemSettings)
    private repo: Repository<SystemSettings>,
  ) {}

  async get(): Promise<SystemSettings> {
    let settings = await this.repo.findOne({ where: { id: 'global' } });
    if (!settings) {
      settings = this.repo.create({ id: 'global', ...DEFAULTS });
      await this.repo.save(settings);
    }
    return settings;
  }

  async update(data: Partial<Omit<SystemSettings, 'id' | 'updatedAt'>>): Promise<SystemSettings> {
    await this.repo.upsert({ id: 'global', ...data }, ['id']);
    return this.get();
  }
}
