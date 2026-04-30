import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, LessThan, Repository } from 'typeorm';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { StockService } from '../stock/stock.service';
import { Rental } from './entities/rental.entity';

const POS_DEFAULT_LOCATION = '__pos_default__';

@Injectable()
export class RentalsService {
  constructor(
    @InjectRepository(Rental)
    private rentalsRepo: Repository<Rental>,
    @InjectDataSource() private dataSource: DataSource,
    private stockService: StockService,
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

  /**
   * Create a rental and reserve stock atomically.
   *
   * The reservation model: physical `stock` does NOT change while an item
   * is out on rental — the gear is still ours, it's just off-site. We bump
   * `rentedQuantity` instead, and the front desk computes
   *   available = stock - rentedQuantity
   * to decide whether more units can go out. This avoids the need for a
   * separate reserved-quantity column and keeps the InventoryItem.stock
   * field meaning "what we own" (stable across rentals).
   *
   * Damage during rental is handled at return time — that's where we may
   * decrement physical stock and append a writeoff movement.
   */
  async create(data: Partial<Rental>): Promise<Rental> {
    if (!data.itemId) {
      throw new BadRequestException('itemId is required');
    }
    return this.dataSource.transaction(async (mgr) => {
      const item = await this.lockItem(mgr, data.itemId!);
      if (!item.isRentable) {
        throw new BadRequestException(
          `Item "${item.name}" is not flagged isRentable`,
        );
      }

      const qty = data.quantity ?? 1;
      const available =
        Number(item.stock) - Number(item.rentedQuantity ?? 0);
      if (available < qty) {
        throw new BadRequestException(
          `Insufficient available units for "${item.name}": have ${available}, need ${qty}`,
        );
      }

      item.rentedQuantity = Number(item.rentedQuantity ?? 0) + qty;
      await mgr.save(InventoryItem, item);

      const rental = mgr.create(Rental, {
        ...data,
        itemName: data.itemName ?? item.name,
      });
      const saved = await mgr.save(Rental, rental);

      // Mirror into unified ledger: rental_out bumps reservedQuantity on
      // StockLevel without changing physical quantity. Same semantics as
      // the legacy InventoryItem.rentedQuantity bump above.
      await this.stockService.apply(
        {
          source: 'inventory',
          itemId: item.id,
          itemName: item.name,
          locationId: item.warehouseId ?? POS_DEFAULT_LOCATION,
          locationKind: item.warehouseId ? 'warehouse' : 'outlet',
          type: 'rental_out',
          quantity: qty,
          performedBy: data.issuedBy ?? 'system',
          performedByName: data.issuedByName,
          referenceType: 'Rental',
          referenceId: saved.id,
        },
        mgr,
      );

      return saved;
    });
  }

  /**
   * Return a rental. Always frees the reserved units; if damaged AND
   * caller asks to write off, also decrements physical stock and appends
   * a 'writeoff' movement to the inventory ledger.
   */
  async returnRental(
    id: string,
    payload: {
      returnedBy: string;
      returnedByName: string;
      condition?: string;
      damageNote?: string;
      damageFee?: number;
      writeOffOnDamage?: boolean;
    },
  ): Promise<Rental> {
    return this.dataSource.transaction(async (mgr) => {
      const rental = await mgr.findOne(Rental, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!rental) throw new NotFoundException('Rental not found');
      if (rental.status === 'returned' || rental.status === 'damaged') {
        // Already settled — return as-is, idempotent.
        return rental;
      }

      rental.actualReturn = new Date();
      rental.returnedBy = payload.returnedBy;
      rental.returnedByName = payload.returnedByName;

      const msPerDay = 1000 * 60 * 60 * 24;
      const actualDays = Math.max(
        1,
        Math.ceil(
          (rental.actualReturn.getTime() -
            new Date(rental.issuedAt).getTime()) /
            msPerDay,
        ),
      );
      rental.totalCharge =
        Number(rental.pricePerDay) * actualDays * rental.quantity;

      // Free the reservation — always.
      const item = await this.lockItem(mgr, rental.itemId);
      item.rentedQuantity = Math.max(
        0,
        Number(item.rentedQuantity ?? 0) - rental.quantity,
      );

      const damaged = payload.condition === 'damaged';
      if (damaged) {
        rental.status = 'damaged';
        rental.damageNote = payload.damageNote ?? '';
        rental.damageFee = payload.damageFee ?? 0;
        rental.totalCharge += Number(rental.damageFee || 0);

        if (payload.writeOffOnDamage) {
          item.stock = Math.max(0, Number(item.stock) - rental.quantity);
          const movement = mgr.create(InventoryMovement, {
            itemId: item.id,
            itemName: item.name,
            type: 'writeoff',
            quantity: rental.quantity,
            balanceAfter: item.stock,
            employeeId: payload.returnedBy,
            employee: payload.returnedByName,
            note: `rental:${rental.id} damaged${
              payload.damageNote ? ` — ${payload.damageNote}` : ''
            }`,
          });
          await mgr.save(InventoryMovement, movement);

          await this.stockService.apply(
            {
              source: 'inventory',
              itemId: item.id,
              itemName: item.name,
              locationId: item.warehouseId ?? POS_DEFAULT_LOCATION,
              locationKind: item.warehouseId ? 'warehouse' : 'outlet',
              type: 'writeoff',
              quantity: rental.quantity,
              performedBy: payload.returnedBy,
              performedByName: payload.returnedByName,
              referenceType: 'Rental',
              referenceId: rental.id,
              notes: `damaged${
                payload.damageNote ? `: ${payload.damageNote}` : ''
              }`,
            },
            mgr,
          );
        }
      } else {
        rental.status = 'returned';
      }

      // Always release the reservation in the unified ledger.
      await this.stockService.apply(
        {
          source: 'inventory',
          itemId: item.id,
          itemName: item.name,
          locationId: item.warehouseId ?? POS_DEFAULT_LOCATION,
          locationKind: item.warehouseId ? 'warehouse' : 'outlet',
          type: 'rental_in',
          quantity: rental.quantity,
          performedBy: payload.returnedBy,
          performedByName: payload.returnedByName,
          referenceType: 'Rental',
          referenceId: rental.id,
        },
        mgr,
      );

      await mgr.save(InventoryItem, item);
      return mgr.save(Rental, rental);
    });
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

  private async lockItem(
    mgr: EntityManager,
    itemId: string,
  ): Promise<InventoryItem> {
    const item = await mgr.findOne(InventoryItem, {
      where: { id: itemId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!item) throw new NotFoundException(`Inventory item ${itemId} not found`);
    return item;
  }
}
