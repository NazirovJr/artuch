import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Stocktake } from './entities/stocktake.entity';
import { StocktakeLine } from './entities/stocktake-line.entity';
import { StockService } from '../stock/stock.service';
import { WarehouseItem } from '../warehouse/entities/warehouse-item.entity';
import { WarehouseTransaction } from '../warehouse/entities/warehouse-transaction.entity';
import {
  ApproveStocktakeDto,
  CancelStocktakeDto,
  CreateStocktakeDto,
  RecordCountDto,
} from './dto/stocktake.dto';

@Injectable()
export class StocktakeService {
  constructor(
    @InjectRepository(Stocktake)
    private stocktakesRepo: Repository<Stocktake>,
    @InjectRepository(StocktakeLine)
    private linesRepo: Repository<StocktakeLine>,
    @InjectDataSource() private dataSource: DataSource,
    private stockService: StockService,
  ) {}

  async findAll(warehouseId?: string, status?: string): Promise<Stocktake[]> {
    const where: any = {};
    if (warehouseId) where.warehouseId = warehouseId;
    if (status) where.status = status;
    return this.stocktakesRepo.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['warehouse'],
    });
  }

  async findById(id: string): Promise<Stocktake> {
    const st = await this.stocktakesRepo.findOne({
      where: { id },
      relations: ['warehouse', 'lines', 'lines.item'],
    });
    if (!st) throw new NotFoundException('Stocktake not found');
    return st;
  }

  /**
   * Start a stocktake: snapshot the *expected* count of every item in the
   * warehouse (or the chosen subset) into stocktake_lines. From this moment
   * the lines record what the system thought was true; later the counter
   * fills in `actual` and the gap is reconciled at approval time.
   *
   * Note: snapshotting reads stock under a transaction but does NOT lock
   * items — concurrent sales during a count are expected. The variance at
   * approval time will reflect both physical losses and ongoing operations
   * since snapshot. For a strict count, freeze operations in the warehouse
   * via business process, not by holding DB locks.
   */
  async create(data: CreateStocktakeDto): Promise<Stocktake> {
    return this.dataSource.transaction(async (mgr) => {
      const itemsQuery = mgr
        .createQueryBuilder(WarehouseItem, 'i')
        .where('i.warehouseId = :wid', { wid: data.warehouseId })
        .andWhere('i.deletedAt IS NULL');
      if (data.category) {
        itemsQuery.andWhere('i.category = :cat', { cat: data.category });
      }
      if (data.itemIds?.length) {
        itemsQuery.andWhere('i.id IN (:...ids)', { ids: data.itemIds });
      }
      const items = await itemsQuery.getMany();
      if (items.length === 0) {
        throw new BadRequestException(
          'No items to count in this warehouse / filter',
        );
      }

      const stocktake = mgr.create(Stocktake, {
        warehouseId: data.warehouseId,
        countedBy: data.countedBy,
        kind: data.kind ?? (data.itemIds?.length ? 'cycle' : 'full'),
        category: data.category,
        notes: data.notes,
        status: 'in_progress',
      });
      const saved = await mgr.save(Stocktake, stocktake);

      const lines = items.map((item) =>
        mgr.create(StocktakeLine, {
          stocktakeId: saved.id,
          itemId: item.id,
          itemName: item.name,
          unit: item.unit,
          expected: Number(item.quantity),
        }),
      );
      await mgr.save(StocktakeLine, lines);

      return this.findByIdInternal(mgr, saved.id);
    });
  }

  async recordCount(
    stocktakeId: string,
    lineId: string,
    data: RecordCountDto,
  ): Promise<StocktakeLine> {
    const line = await this.linesRepo.findOne({
      where: { id: lineId, stocktakeId },
      relations: ['stocktake'],
    });
    if (!line) throw new NotFoundException('Stocktake line not found');
    if (
      line.stocktake.status !== 'in_progress' &&
      line.stocktake.status !== 'awaiting_approval'
    ) {
      throw new BadRequestException(
        `Cannot edit lines in status ${line.stocktake.status}`,
      );
    }

    line.actual = Number(data.actual);
    line.variance = line.actual - Number(line.expected);
    if (data.varianceReason !== undefined) {
      line.varianceReason = data.varianceReason;
    }
    if (data.note !== undefined) {
      line.note = data.note;
    }
    return this.linesRepo.save(line);
  }

  async submitForApproval(stocktakeId: string): Promise<Stocktake> {
    const st = await this.findById(stocktakeId);
    if (st.status !== 'in_progress') {
      throw new BadRequestException(
        `Cannot submit stocktake in status ${st.status}`,
      );
    }
    const uncounted = st.lines.filter(
      (l) => l.actual === null || l.actual === undefined,
    );
    if (uncounted.length > 0) {
      throw new BadRequestException(
        `${uncounted.length} line(s) have no actual count`,
      );
    }
    st.status = 'awaiting_approval';
    return this.stocktakesRepo.save(st);
  }

  /**
   * Approve a stocktake: for each line with a non-zero variance, append a
   * compensating ledger entry — 'writeoff' for shortages, 'return' for
   * overages — and update the item.quantity to match the actual count.
   * The ledger remains the source of truth; the item.quantity only gets
   * snapped to actual.
   */
  async approve(
    stocktakeId: string,
    data: ApproveStocktakeDto,
  ): Promise<Stocktake> {
    return this.dataSource.transaction(async (mgr) => {
      const st = await mgr.findOne(Stocktake, {
        where: { id: stocktakeId },
        relations: ['lines'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!st) throw new NotFoundException('Stocktake not found');
      if (
        st.status !== 'awaiting_approval' &&
        st.status !== 'in_progress'
      ) {
        throw new BadRequestException(
          `Cannot approve stocktake in status ${st.status}`,
        );
      }

      for (const line of st.lines) {
        if (line.actual === null || line.actual === undefined) {
          throw new BadRequestException(
            `Line ${line.itemName} has no actual count`,
          );
        }
        const variance = Number(line.actual) - Number(line.expected);
        if (variance === 0) continue;

        const item = await mgr.findOne(WarehouseItem, {
          where: { id: line.itemId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!item) continue;

        // Snap stock to actual. Note: between snapshot and approval, sales
        // may have happened — this overwrites those into the actual count.
        // Operationally, ops should freeze the warehouse during the count.
        item.quantity = Number(line.actual);
        await mgr.save(WarehouseItem, item);

        const tx = mgr.create(WarehouseTransaction, {
          type: variance < 0 ? 'writeoff' : 'return',
          itemId: item.id,
          quantity: Math.abs(variance),
          balanceAfter: item.quantity,
          performedBy: data.approvedBy,
          notes: `stocktake:${st.id} ${
            variance < 0 ? 'shortage' : 'overage'
          }${line.varianceReason ? ` (${line.varianceReason})` : ''}${
            line.note ? ` — ${line.note}` : ''
          }`,
        });
        await mgr.save(WarehouseTransaction, tx);

        // Mirror into unified ledger as a single 'stocktake' movement
        // (the new unified model has a dedicated type for this).
        await this.stockService.setExact(
          {
            source: 'warehouse',
            itemId: item.id,
            itemName: item.name,
            locationId: item.warehouseId ?? st.warehouseId,
            locationKind: 'warehouse',
            newQuantity: Number(line.actual),
            performedBy: data.approvedBy,
            referenceType: 'Stocktake',
            referenceId: st.id,
            notes: line.varianceReason ?? line.note,
          },
          mgr,
        );
      }

      st.status = 'approved';
      st.approvedBy = data.approvedBy;
      st.approvedAt = new Date();
      if (data.notes) {
        st.notes = st.notes ? `${st.notes}\n${data.notes}` : data.notes;
      }
      return mgr.save(Stocktake, st);
    });
  }

  async cancel(
    stocktakeId: string,
    data: CancelStocktakeDto,
  ): Promise<Stocktake> {
    const st = await this.findById(stocktakeId);
    if (st.status === 'approved' || st.status === 'cancelled') {
      throw new BadRequestException(
        `Cannot cancel stocktake in status ${st.status}`,
      );
    }
    st.status = 'cancelled';
    st.cancelledBy = data.cancelledBy;
    st.cancelledAt = new Date();
    if (data.notes) {
      st.notes = st.notes ? `${st.notes}\n${data.notes}` : data.notes;
    }
    return this.stocktakesRepo.save(st);
  }

  private async findByIdInternal(
    mgr: { findOne: typeof this.stocktakesRepo.findOne },
    id: string,
  ): Promise<Stocktake> {
    const st = await mgr.findOne(Stocktake, {
      where: { id },
      relations: ['warehouse', 'lines', 'lines.item'],
    } as any);
    if (!st) throw new NotFoundException('Stocktake not found');
    return st;
  }
}
