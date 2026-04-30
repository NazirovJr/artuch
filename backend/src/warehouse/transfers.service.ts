import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { StockService } from '../stock/stock.service';
import { StockTransfer } from './entities/stock-transfer.entity';
import { WarehouseItem } from './entities/warehouse-item.entity';
import { WarehouseTransaction } from './entities/warehouse-transaction.entity';
import {
  CancelTransferDto,
  CreateTransferDto,
  ReceiveTransferDto,
} from './dto/create-transfer.dto';

@Injectable()
export class TransfersService {
  constructor(
    @InjectRepository(StockTransfer)
    private transfersRepo: Repository<StockTransfer>,
    @InjectDataSource() private dataSource: DataSource,
    private stockService: StockService,
  ) {}

  async findAll(status?: string): Promise<StockTransfer[]> {
    return this.transfersRepo.find({
      where: status ? { status: status as any } : {},
      order: { createdAt: 'DESC' },
      relations: ['sourceWarehouse', 'targetWarehouse', 'sourceItem'],
    });
  }

  async findById(id: string): Promise<StockTransfer> {
    const transfer = await this.transfersRepo.findOne({
      where: { id },
      relations: ['sourceWarehouse', 'targetWarehouse', 'sourceItem'],
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    return transfer;
  }

  /**
   * Step 1 — issue: lock the source item, decrement its stock, create the
   * transfer in 'in_transit'. The target warehouse stock is NOT touched
   * yet; the in-transit qty effectively lives on the StockTransfer row.
   */
  async create(data: CreateTransferDto): Promise<StockTransfer> {
    if (data.sourceWarehouseId === data.targetWarehouseId) {
      throw new BadRequestException(
        'source and target warehouses must differ',
      );
    }

    return this.dataSource.transaction(async (mgr) => {
      if (data.idempotencyKey) {
        const existing = await mgr.findOne(StockTransfer, {
          where: { idempotencyKey: data.idempotencyKey },
        });
        if (existing) return existing;
      }

      const sourceItem = await mgr.findOne(WarehouseItem, {
        where: {
          id: data.sourceItemId,
          warehouseId: data.sourceWarehouseId,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!sourceItem) {
        throw new NotFoundException(
          'Source item not found in source warehouse',
        );
      }

      const qty = Number(data.quantity);
      const current = Number(sourceItem.quantity);
      if (current - qty < 0) {
        throw new BadRequestException(
          `Insufficient stock: have ${current} ${sourceItem.unit}, need ${qty}`,
        );
      }

      sourceItem.quantity = current - qty;
      await mgr.save(WarehouseItem, sourceItem);

      const transfer = mgr.create(StockTransfer, {
        sourceWarehouseId: data.sourceWarehouseId,
        targetWarehouseId: data.targetWarehouseId,
        sourceItemId: sourceItem.id,
        quantity: qty,
        status: 'in_transit',
        notes: data.notes,
        createdBy: data.createdBy,
        idempotencyKey: data.idempotencyKey,
      });
      const saved = await mgr.save(StockTransfer, transfer);

      // Append outgoing leg to the legacy immutable ledger.
      const tx = mgr.create(WarehouseTransaction, {
        type: 'transfer',
        itemId: sourceItem.id,
        quantity: qty,
        balanceAfter: sourceItem.quantity,
        performedBy: data.createdBy,
        sourceWarehouseId: data.sourceWarehouseId,
        targetWarehouseId: data.targetWarehouseId,
        notes: `transfer:${saved.id} out`,
      });
      await mgr.save(WarehouseTransaction, tx);

      // Mirror outgoing leg into the unified ledger. The receive() step
      // appends transfer_in; cancel() appends a return. So we can pair the
      // two halves by referenceId in reports.
      await this.stockService.apply(
        {
          source: 'warehouse',
          itemId: sourceItem.id,
          itemName: sourceItem.name,
          locationId: data.sourceWarehouseId,
          locationKind: 'warehouse',
          type: 'transfer_out',
          quantity: qty,
          performedBy: data.createdBy,
          referenceType: 'StockTransfer',
          referenceId: saved.id,
          notes: data.notes,
          idempotencyKey: data.idempotencyKey
            ? `${data.idempotencyKey}:transfer-out`
            : undefined,
        },
        mgr,
      );

      return saved;
    });
  }

  /**
   * Step 2 — receive: increment target stock by receivedQuantity (defaults
   * to the original sent quantity). Variance is preserved on the transfer
   * for later reconciliation. Idempotent on transfer.status — a second
   * receive call returns the already-received transfer.
   */
  async receive(
    id: string,
    data: ReceiveTransferDto,
  ): Promise<StockTransfer> {
    return this.dataSource.transaction(async (mgr) => {
      const transfer = await mgr.findOne(StockTransfer, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!transfer) throw new NotFoundException('Transfer not found');
      if (transfer.status === 'received') return transfer;
      if (transfer.status !== 'in_transit') {
        throw new BadRequestException(
          `Transfer cannot be received in status ${transfer.status}`,
        );
      }

      const sentQty = Number(transfer.quantity);
      const receivedQty =
        data.receivedQuantity !== undefined
          ? Number(data.receivedQuantity)
          : sentQty;
      if (receivedQty < 0 || receivedQty > sentQty) {
        throw new BadRequestException(
          `receivedQuantity must be between 0 and ${sentQty}`,
        );
      }

      const sourceItem = await mgr.findOne(WarehouseItem, {
        where: { id: transfer.sourceItemId },
      });
      if (!sourceItem) {
        throw new NotFoundException('Source item disappeared');
      }

      // Find or create the matching SKU row in the target warehouse.
      let targetItem = await mgr.findOne(WarehouseItem, {
        where: {
          name: sourceItem.name,
          unit: sourceItem.unit,
          category: sourceItem.category,
          warehouseId: transfer.targetWarehouseId,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!targetItem) {
        targetItem = mgr.create(WarehouseItem, {
          name: sourceItem.name,
          unit: sourceItem.unit,
          category: sourceItem.category,
          price: sourceItem.price,
          minQuantity: sourceItem.minQuantity,
          quantity: 0,
          warehouseId: transfer.targetWarehouseId,
        });
        targetItem = await mgr.save(WarehouseItem, targetItem);
      }

      targetItem.quantity = Number(targetItem.quantity) + receivedQty;
      await mgr.save(WarehouseItem, targetItem);

      transfer.status = 'received';
      transfer.receivedQuantity = receivedQty;
      transfer.targetItemId = targetItem.id;
      transfer.receivedBy = data.receivedBy;
      transfer.receivedAt = new Date();
      if (data.notes) {
        transfer.notes = transfer.notes
          ? `${transfer.notes}\n${data.notes}`
          : data.notes;
      }
      await mgr.save(StockTransfer, transfer);

      // Incoming leg in the legacy ledger.
      const tx = mgr.create(WarehouseTransaction, {
        type: 'transfer',
        itemId: targetItem.id,
        quantity: receivedQty,
        balanceAfter: targetItem.quantity,
        performedBy: data.receivedBy,
        sourceWarehouseId: transfer.sourceWarehouseId,
        targetWarehouseId: transfer.targetWarehouseId,
        notes: `transfer:${transfer.id} in${
          receivedQty < sentQty
            ? ` (variance ${(sentQty - receivedQty).toFixed(2)})`
            : ''
        }`,
      });
      await mgr.save(WarehouseTransaction, tx);

      // Mirror into unified ledger.
      await this.stockService.apply(
        {
          source: 'warehouse',
          itemId: targetItem.id,
          itemName: targetItem.name,
          locationId: transfer.targetWarehouseId,
          locationKind: 'warehouse',
          type: 'transfer_in',
          quantity: receivedQty,
          performedBy: data.receivedBy,
          referenceType: 'StockTransfer',
          referenceId: transfer.id,
          notes: data.notes,
        },
        mgr,
      );

      // If there was a variance, append a writeoff for the lost amount so
      // the ledger balances and someone can investigate the gap.
      if (receivedQty < sentQty) {
        const lost = sentQty - receivedQty;
        const writeoff = mgr.create(WarehouseTransaction, {
          type: 'writeoff',
          itemId: transfer.sourceItemId,
          quantity: lost,
          balanceAfter: Number(sourceItem.quantity),
          performedBy: data.receivedBy,
          notes: `transfer:${transfer.id} in-transit loss`,
        });
        await mgr.save(WarehouseTransaction, writeoff);
        await this.stockService.apply(
          {
            source: 'warehouse',
            itemId: transfer.sourceItemId,
            itemName: sourceItem.name,
            locationId: transfer.sourceWarehouseId,
            locationKind: 'warehouse',
            type: 'writeoff',
            quantity: lost,
            performedBy: data.receivedBy,
            referenceType: 'StockTransfer',
            referenceId: transfer.id,
            notes: 'in-transit loss',
          },
          mgr,
        );
      }

      return transfer;
    });
  }

  /**
   * Step 2 (alt) — cancel: restore source stock, mark cancelled. Only valid
   * while in_transit. The compensating ledger entry is a 'return' from the
   * symbolic in-transit pool back to the source.
   */
  async cancel(
    id: string,
    data: CancelTransferDto,
  ): Promise<StockTransfer> {
    return this.dataSource.transaction(async (mgr) => {
      const transfer = await mgr.findOne(StockTransfer, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!transfer) throw new NotFoundException('Transfer not found');
      if (transfer.status === 'cancelled') return transfer;
      if (transfer.status !== 'in_transit') {
        throw new BadRequestException(
          `Transfer cannot be cancelled in status ${transfer.status}`,
        );
      }

      const sourceItem = await mgr.findOne(WarehouseItem, {
        where: { id: transfer.sourceItemId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!sourceItem) {
        throw new NotFoundException('Source item not found');
      }

      const qty = Number(transfer.quantity);
      sourceItem.quantity = Number(sourceItem.quantity) + qty;
      await mgr.save(WarehouseItem, sourceItem);

      transfer.status = 'cancelled';
      transfer.cancelledBy = data.cancelledBy;
      transfer.cancelledAt = new Date();
      if (data.notes) {
        transfer.notes = transfer.notes
          ? `${transfer.notes}\n${data.notes}`
          : data.notes;
      }
      await mgr.save(StockTransfer, transfer);

      const tx = mgr.create(WarehouseTransaction, {
        type: 'return',
        itemId: sourceItem.id,
        quantity: qty,
        balanceAfter: sourceItem.quantity,
        performedBy: data.cancelledBy,
        notes: `transfer:${transfer.id} cancelled`,
      });
      await mgr.save(WarehouseTransaction, tx);

      await this.stockService.apply(
        {
          source: 'warehouse',
          itemId: sourceItem.id,
          itemName: sourceItem.name,
          locationId: transfer.sourceWarehouseId,
          locationKind: 'warehouse',
          type: 'return_customer',
          quantity: qty,
          performedBy: data.cancelledBy,
          referenceType: 'StockTransfer',
          referenceId: transfer.id,
          notes: `cancelled: ${data.notes ?? ''}`,
        },
        mgr,
      );

      return transfer;
    });
  }
}
