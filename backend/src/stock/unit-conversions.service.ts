import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { StockSource } from './entities/stock-level.entity';
import { UnitConversion } from './entities/unit-conversion.entity';

@Injectable()
export class UnitConversionsService {
  constructor(
    @InjectRepository(UnitConversion)
    private repo: Repository<UnitConversion>,
  ) {}

  async findForItem(
    source: StockSource,
    itemId: string,
  ): Promise<UnitConversion[]> {
    return this.repo.find({ where: { source, itemId } });
  }

  /**
   * Convert `quantity` of `inputUnit` to canonical units.
   *
   * Rules:
   *   - inputUnit equal to canonical (or undefined) → no conversion.
   *   - inputUnit matches a conversion row → multiply by factor.
   *   - inputUnit unknown → throw (we'd rather fail loudly than silently
   *     mis-record a delivery as 1 ml when it was 1 box).
   */
  async toCanonical(p: {
    source: StockSource;
    itemId: string;
    canonicalUnit: string;
    quantity: number;
    inputUnit?: string;
  }): Promise<number> {
    if (!p.inputUnit || p.inputUnit === p.canonicalUnit) {
      return Number(p.quantity);
    }
    const conv = await this.repo.findOne({
      where: { source: p.source, itemId: p.itemId, fromUnit: p.inputUnit },
    });
    if (!conv) {
      throw new BadRequestException(
        `No conversion defined for "${p.inputUnit}" → "${p.canonicalUnit}" on this item`,
      );
    }
    return Number(p.quantity) * Number(conv.factor);
  }

  async upsert(p: {
    source: StockSource;
    itemId: string;
    fromUnit: string;
    factor: number;
    notes?: string;
  }): Promise<UnitConversion> {
    if (p.factor <= 0) {
      throw new BadRequestException('factor must be positive');
    }
    const existing = await this.repo.findOne({
      where: {
        source: p.source,
        itemId: p.itemId,
        fromUnit: p.fromUnit,
      },
    });
    if (existing) {
      existing.factor = p.factor;
      if (p.notes !== undefined) existing.notes = p.notes;
      return this.repo.save(existing);
    }
    const created = this.repo.create({
      source: p.source,
      itemId: p.itemId,
      fromUnit: p.fromUnit,
      factor: p.factor,
      notes: p.notes,
    });
    return this.repo.save(created);
  }

  async remove(id: string): Promise<void> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Conversion not found');
    await this.repo.remove(found);
  }
}
