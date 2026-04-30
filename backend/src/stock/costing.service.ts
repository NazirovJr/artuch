import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { StockLot } from './entities/stock-lot.entity';
import {
  StockMovement,
  StockMovementType,
} from './entities/stock-movement.entity';
import type { StockSource } from './entities/stock-level.entity';

const COGS_TYPES: StockMovementType[] = [
  'issue',
  'sale',
  'writeoff',
  'transfer_out',
  'return_supplier',
];

export interface ValuationRow {
  source: StockSource;
  itemId: string;
  itemName: string;
  locationId: string;
  totalQuantity: number;
  totalValue: number;
  // Average unit cost across all active lots — useful when one item has
  // multiple lots at different prices.
  averageUnitCost: number;
}

export interface COGSReport {
  totalQuantity: number;
  totalCost: number;
  byType: Record<string, { quantity: number; cost: number }>;
}

/**
 * Reads off the unified ledger (StockMovement.totalCost) and lot table
 * (StockLot.remainingQuantity * StockLot.unitCost) to answer:
 *
 *   - "What did we sell vs spend at cost over the last week?"  (COGS)
 *   - "What's our stock worth right now?"                     (valuation)
 *
 * COGS comes from movements because that's where the actual consumption
 * happened (with the lot's then-current cost frozen in). Valuation comes
 * from lots because that's where remaining stock + cost basis live.
 */
@Injectable()
export class CostingService {
  constructor(
    @InjectRepository(StockMovement)
    private movementsRepo: Repository<StockMovement>,
    @InjectRepository(StockLot)
    private lotsRepo: Repository<StockLot>,
  ) {}

  async getCOGS(p: {
    source?: StockSource;
    itemId?: string;
    locationId?: string;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<COGSReport> {
    const qb = this.movementsRepo
      .createQueryBuilder('m')
      .where('m.type IN (:...types)', { types: COGS_TYPES });
    if (p.source) qb.andWhere('m.source = :source', { source: p.source });
    if (p.itemId) qb.andWhere('m.itemId = :itemId', { itemId: p.itemId });
    if (p.locationId) {
      qb.andWhere('m.locationId = :locationId', { locationId: p.locationId });
    }
    if (p.fromDate) qb.andWhere('m.createdAt >= :from', { from: p.fromDate });
    if (p.toDate) qb.andWhere('m.createdAt <= :to', { to: p.toDate });

    const movements = await qb.getMany();

    const byType: Record<string, { quantity: number; cost: number }> = {};
    let totalQuantity = 0;
    let totalCost = 0;

    for (const m of movements) {
      const qty = Number(m.quantity);
      const cost = m.totalCost != null ? Number(m.totalCost) : 0;
      totalQuantity += qty;
      totalCost += cost;
      if (!byType[m.type]) byType[m.type] = { quantity: 0, cost: 0 };
      byType[m.type].quantity += qty;
      byType[m.type].cost += cost;
    }

    return { totalQuantity, totalCost, byType };
  }

  /**
   * Per-item valuation across all active lots at the given location (or
   * everywhere if locationId is omitted). Returns one row per
   * (source, itemId) — multiple lots of the same item are aggregated
   * with quantity-weighted average unit cost.
   */
  async getValuation(p: {
    source?: StockSource;
    locationId?: string;
  }): Promise<ValuationRow[]> {
    const qb = this.lotsRepo
      .createQueryBuilder('lot')
      .where('lot.isActive = true')
      .andWhere('lot.remainingQuantity > 0');
    if (p.source) qb.andWhere('lot.source = :source', { source: p.source });
    if (p.locationId) {
      qb.andWhere('lot.locationId = :locationId', {
        locationId: p.locationId,
      });
    }
    const lots = await qb.getMany();

    type Bucket = {
      source: StockSource;
      itemId: string;
      itemName: string;
      locationId: string;
      qty: number;
      value: number;
    };
    const buckets = new Map<string, Bucket>();

    for (const lot of lots) {
      const key = `${lot.source}|${lot.itemId}|${lot.locationId}`;
      const qty = Number(lot.remainingQuantity);
      const cost = lot.unitCost != null ? Number(lot.unitCost) * qty : 0;
      const existing = buckets.get(key);
      if (existing) {
        existing.qty += qty;
        existing.value += cost;
      } else {
        buckets.set(key, {
          source: lot.source,
          itemId: lot.itemId,
          itemName: lot.itemName,
          locationId: lot.locationId,
          qty,
          value: cost,
        });
      }
    }

    return Array.from(buckets.values()).map((b) => ({
      source: b.source,
      itemId: b.itemId,
      itemName: b.itemName,
      locationId: b.locationId,
      totalQuantity: b.qty,
      totalValue: b.value,
      averageUnitCost: b.qty > 0 ? b.value / b.qty : 0,
    }));
  }
}
