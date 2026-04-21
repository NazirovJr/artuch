import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from './entities/booking.entity';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking) private bookingsRepo: Repository<Booking>,
  ) {}

  async findAll(userId?: string): Promise<Booking[]> {
    const where: any = {};
    if (userId) where.userId = userId;
    return this.bookingsRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async create(data: Partial<Booking>): Promise<Booking> {
    const booking = this.bookingsRepo.create(data);
    return this.bookingsRepo.save(booking);
  }

  async update(id: string, data: Partial<Booking>): Promise<Booking> {
    const booking = await this.bookingsRepo.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    Object.assign(booking, data);
    return this.bookingsRepo.save(booking);
  }
}
