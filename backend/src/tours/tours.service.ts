import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tour } from './entities/tour.entity';

@Injectable()
export class ToursService {
  constructor(
    @InjectRepository(Tour) private toursRepo: Repository<Tour>,
  ) {}

  async findAll(category?: string): Promise<Tour[]> {
    const where: any = { isActive: true };
    if (category) where.categoryId = category;
    return this.toursRepo.find({ where, order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Tour | null> {
    return this.toursRepo.findOne({ where: { id } });
  }
}
