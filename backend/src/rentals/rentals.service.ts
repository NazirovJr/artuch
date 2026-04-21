import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Rental } from './entities/rental.entity';

@Injectable()
export class RentalsService {
  constructor(
    @InjectRepository(Rental)
    private rentalsRepo: Repository<Rental>,
  ) {}

  async findAll(status?: string): Promise<Rental[]> {
    const where: any = {};
    if (status) where.status = status;
    return this.rentalsRepo.find({ where, order: { issuedAt: 'DESC' } });
  }

  async findById(id: string): Promise<Rental> {
    const rental = await this.rentalsRepo.findOne({ where: { id } });
    if (!rental) throw new NotFoundException('Rental not found');
    return rental;
  }

  async create(data: Partial<Rental>): Promise<Rental> {
    const rental = this.rentalsRepo.create(data);
    return this.rentalsRepo.save(rental);
  }

  async returnRental(
    id: string,
    payload: {
      returnedBy: string;
      returnedByName: string;
      condition?: string;
      damageNote?: string;
      damageFee?: number;
    },
  ): Promise<Rental> {
    const rental = await this.findById(id);

    rental.actualReturn = new Date();
    rental.returnedBy = payload.returnedBy;
    rental.returnedByName = payload.returnedByName;

    // Calculate actual days (minimum 1 day)
    const msPerDay = 1000 * 60 * 60 * 24;
    const actualDays = Math.max(
      1,
      Math.ceil(
        (rental.actualReturn.getTime() - new Date(rental.issuedAt).getTime()) /
          msPerDay,
      ),
    );
    rental.totalCharge = Number(rental.pricePerDay) * actualDays * rental.quantity;

    if (payload.condition === 'damaged') {
      rental.status = 'damaged';
      rental.damageNote = payload.damageNote ?? '';
      rental.damageFee = payload.damageFee ?? 0;
      rental.totalCharge += Number(rental.damageFee || 0);
    } else {
      rental.status = 'returned';
    }

    return this.rentalsRepo.save(rental);
  }

  async extendRental(id: string, newDate: Date): Promise<Rental> {
    const rental = await this.findById(id);
    rental.expectedReturn = newDate;
    return this.rentalsRepo.save(rental);
  }

  async findOverdue(): Promise<Rental[]> {
    return this.rentalsRepo.find({
      where: {
        status: 'active',
        expectedReturn: LessThan(new Date()),
      },
      order: { expectedReturn: 'ASC' },
    });
  }
}
