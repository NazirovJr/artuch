import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Outlet } from './entities/outlet.entity';
import { UserOutlet } from './entities/user-outlet.entity';

@Injectable()
export class OutletsService {
  constructor(
    @InjectRepository(Outlet)
    private outletRepo: Repository<Outlet>,
    @InjectRepository(UserOutlet)
    private userOutletRepo: Repository<UserOutlet>,
  ) {}

  async findAll(): Promise<Outlet[]> {
    return this.outletRepo.find({ where: { isActive: true } });
  }

  async findById(id: string): Promise<Outlet> {
    const outlet = await this.outletRepo.findOne({ where: { id } });
    if (!outlet) throw new NotFoundException('Outlet not found');
    return outlet;
  }

  async create(data: Partial<Outlet>): Promise<Outlet> {
    const outlet = this.outletRepo.create(data);
    return this.outletRepo.save(outlet);
  }

  async update(id: string, data: Partial<Outlet>): Promise<Outlet> {
    const outlet = await this.findById(id);
    Object.assign(outlet, data);
    return this.outletRepo.save(outlet);
  }

  async remove(id: string): Promise<Outlet> {
    const outlet = await this.findById(id);
    outlet.isActive = false;
    return this.outletRepo.save(outlet);
  }

  async assignUser(outletId: string, userId: string): Promise<UserOutlet> {
    const existing = await this.userOutletRepo.findOne({
      where: { outletId, userId },
    });
    if (existing) return existing;

    const record = this.userOutletRepo.create({ outletId, userId });
    return this.userOutletRepo.save(record);
  }

  async unassignUser(outletId: string, userId: string): Promise<void> {
    await this.userOutletRepo.delete({ outletId, userId });
  }

  async getOutletsForUser(userId: string): Promise<Outlet[]> {
    const records = await this.userOutletRepo.find({
      where: { userId },
      relations: ['outlet'],
    });
    return records.map((r) => r.outlet);
  }

  async getUsersForOutlet(outletId: string): Promise<UserOutlet[]> {
    return this.userOutletRepo.find({
      where: { outletId },
      relations: ['user'],
    });
  }
}
