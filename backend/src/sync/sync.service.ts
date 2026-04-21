import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Transaction } from '../pos/entities/transaction.entity';
import { Order } from '../restaurant/entities/order.entity';
import { Room } from '../hotel/entities/room.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { WarehouseItem } from '../warehouse/entities/warehouse-item.entity';
import { Reservation } from '../hotel/entities/reservation.entity';
import { Guest } from '../hotel/entities/guest.entity';

@Injectable()
export class SyncService {
  constructor(
    @InjectRepository(Transaction) private txRepo: Repository<Transaction>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(Room) private roomRepo: Repository<Room>,
    @InjectRepository(InventoryItem) private invRepo: Repository<InventoryItem>,
    @InjectRepository(WarehouseItem) private whRepo: Repository<WarehouseItem>,
    @InjectRepository(Reservation) private resRepo: Repository<Reservation>,
    @InjectRepository(Guest) private guestRepo: Repository<Guest>,
  ) {}

  async pull(lastSyncAt?: string) {
    const since = lastSyncAt ? new Date(lastSyncAt) : new Date(0);
    const filter = { where: { updatedAt: MoreThan(since) } };
    const whFilter = { where: { lastUpdated: MoreThan(since) } };

    const [transactions, orders, rooms, inventory, warehouseItems, reservations, guests] = await Promise.all([
      this.txRepo.find({ ...filter, relations: ['items'] }),
      this.orderRepo.find({ ...filter, relations: ['items'] }),
      this.roomRepo.find(), // rooms are always all synced (small set)
      this.invRepo.find(filter),
      this.whRepo.find(whFilter),
      this.resRepo.find(filter),
      this.guestRepo.find(filter),
    ]);

    return {
      transactions,
      orders,
      rooms,
      inventory,
      warehouseItems,
      reservations,
      guests,
      syncedAt: new Date().toISOString(),
    };
  }

  async push(changes: {
    transactions?: any[];
    orders?: any[];
    rooms?: Array<{ number: number; status?: string; cleaningStatus?: string }>;
  }) {
    const results = { transactions: 0, orders: 0, rooms: 0 };

    // Transactions: append-only (never conflict)
    if (changes.transactions?.length) {
      for (const tx of changes.transactions) {
        const existing = await this.txRepo.findOne({ where: { id: tx.id } });
        if (!existing) {
          await this.txRepo.save(tx);
          results.transactions++;
        }
      }
    }

    // Orders: append-only for creation, last-write-wins for status
    if (changes.orders?.length) {
      for (const order of changes.orders) {
        const existing = await this.orderRepo.findOne({ where: { id: order.id } });
        if (!existing) {
          await this.orderRepo.save(order);
          results.orders++;
        } else if (order.updatedAt > existing.updatedAt) {
          await this.orderRepo.update(order.id, { status: order.status, updatedAt: new Date() });
          results.orders++;
        }
      }
    }

    // Rooms: last-write-wins
    if (changes.rooms?.length) {
      for (const room of changes.rooms) {
        await this.roomRepo.update(room.number, {
          ...(room.status && { status: room.status }),
          ...(room.cleaningStatus && { cleaningStatus: room.cleaningStatus }),
        });
        results.rooms++;
      }
    }

    return { accepted: results, syncedAt: new Date().toISOString() };
  }
}
