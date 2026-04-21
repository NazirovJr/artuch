import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WarehouseItem } from './entities/warehouse-item.entity';
import { WarehouseTransaction } from './entities/warehouse-transaction.entity';

@Injectable()
export class WarehouseService {
  constructor(
    @InjectRepository(WarehouseItem) private itemsRepo: Repository<WarehouseItem>,
    @InjectRepository(WarehouseTransaction) private transRepo: Repository<WarehouseTransaction>,
  ) {}

  async findAllItems(): Promise<WarehouseItem[]> {
    return this.itemsRepo.find({ order: { category: 'ASC', name: 'ASC' } });
  }

  async findAllTransactions(): Promise<WarehouseTransaction[]> {
    return this.transRepo.find({ order: { createdAt: 'DESC' }, relations: ['item'] });
  }

  async createTransaction(data: Partial<WarehouseTransaction>): Promise<WarehouseTransaction> {
    const item = await this.itemsRepo.findOne({ where: { id: data.itemId } });
    if (!item) throw new NotFoundException('Warehouse item not found');
    if (data.type === 'income') {
      item.quantity = Number(item.quantity) + Number(data.quantity);
    } else {
      item.quantity = Number(item.quantity) - Number(data.quantity);
    }
    await this.itemsRepo.save(item);
    const transaction = this.transRepo.create(data);
    return this.transRepo.save(transaction);
  }
}
