import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryMovement } from './entities/inventory-movement.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private itemsRepo: Repository<InventoryItem>,
    @InjectRepository(InventoryMovement)
    private movementsRepo: Repository<InventoryMovement>,
  ) {}

  async findAllItems(category?: string): Promise<InventoryItem[]> {
    const where: any = { isActive: true };
    if (category) where.category = category;
    return this.itemsRepo.find({ where, order: { category: 'ASC', name: 'ASC' } });
  }

  async findItemById(id: string): Promise<InventoryItem> {
    const item = await this.itemsRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async createItem(data: Partial<InventoryItem>): Promise<InventoryItem> {
    const item = this.itemsRepo.create(data);
    return this.itemsRepo.save(item);
  }

  async updateItem(id: string, data: Partial<InventoryItem>): Promise<InventoryItem> {
    const item = await this.findItemById(id);
    Object.assign(item, data);
    return this.itemsRepo.save(item);
  }

  async findAllMovements(): Promise<InventoryMovement[]> {
    return this.movementsRepo.find({ order: { createdAt: 'DESC' } });
  }

  /**
   * For draft/weighed items (unit='ml'|'g') stock is in raw units, but sales
   * come in "servings" (e.g. one pour). Convert servings → raw using the
   * item's mlPerServing so theoretical stock matches reality and shrinkage
   * reports can be trusted. Income is always in raw units already.
   */
  private toStockUnits(item: InventoryItem, quantity: number): number {
    if ((item.unit === 'ml' || item.unit === 'g') && item.mlPerServing) {
      return quantity * Number(item.mlPerServing);
    }
    return quantity;
  }

  async addMovement(data: Partial<InventoryMovement>): Promise<InventoryMovement> {
    const item = await this.findItemById(data.itemId!);

    if (data.type === 'income') {
      // Income (восполнение склада) приходит в сырых единицах — баррель/бутылка
      // 30 000 мл, упаковка 5 кг и т.д. — без пересчёта.
      item.stock += data.quantity!;
      if (data.price) item.purchasePrice = data.price;
    } else if (data.type === 'expense' || data.type === 'sale') {
      const decrementBy = this.toStockUnits(item, data.quantity!);
      item.stock -= decrementBy;
      if (data.type === 'sale') item.soldCount += data.quantity!;
    }
    await this.itemsRepo.save(item);

    const movement = this.movementsRepo.create({ ...data, itemName: item.name });
    return this.movementsRepo.save(movement);
  }

  async decrementStock(itemName: string, quantity: number): Promise<void> {
    const item = await this.itemsRepo.findOne({ where: { name: itemName } });
    if (item) {
      item.stock -= this.toStockUnits(item, quantity);
      item.soldCount += quantity;
      await this.itemsRepo.save(item);
    }
  }
}
